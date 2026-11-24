-- Simplified access model.
--
-- Store managers no longer have accounts. They open one private link, pick
-- their store, and submit the week. The web server checks the link's secret
-- and writes with the service role through save_week(); the public API keys
-- can read or write none of this.
--
-- Signed-in users with the executive role (upper management) see everything.

-- ---------------------------------------------------------------------------
-- Roles are a fixed list.
-- ---------------------------------------------------------------------------

alter table public.employees rename column position to role;
alter table public.employees alter column role set default 'Sales Associate';
alter table public.employees
  add constraint employees_role_check
  check (role in ('Cashier', 'Sales Associate', 'Keyholder'));

alter table public.shifts rename column position to role;
update public.shifts s set role = e.role from public.employees e where e.id = s.employee_id and s.role is null;
alter table public.shifts alter column role set not null;
alter table public.shifts
  add constraint shifts_role_check
  check (role in ('Cashier', 'Sales Associate', 'Keyholder'));

-- Managers type names, so the same person must map to one row per store.
create unique index employees_store_name_key
  on public.employees (store_id, lower(trim(full_name)));

-- ---------------------------------------------------------------------------
-- Who submitted each store's week.
-- ---------------------------------------------------------------------------

create table public.week_submissions (
  store_id     uuid not null references public.stores (id) on delete cascade,
  week_start   date not null,
  submitted_by text not null,
  submitted_at timestamptz not null default now(),
  primary key (store_id, week_start)
);
alter table public.week_submissions enable row level security;
create policy week_submissions_select on public.week_submissions for select to authenticated
  using ((select public.is_executive()));

alter table public.audit_log add column actor_name text;

create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log
    (actor, actor_name, store_id, table_name, action, row_id, old_row, new_row)
  values (
    auth.uid(),
    nullif(current_setting('app.actor_name', true), ''),
    (r ->> 'store_id')::uuid,
    tg_table_name,
    lower(tg_op),
    (r ->> 'id')::uuid,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end
$$;
revoke execute on function public.write_audit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The manager link's secret. Service role only: RLS on, no policies.
-- ---------------------------------------------------------------------------

create table public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

insert into public.app_settings (key, value)
values ('manager_link_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Access: upper management only. Store assignments are gone.
-- ---------------------------------------------------------------------------

drop policy stores_select on public.stores;
create policy stores_select on public.stores for select to authenticated
  using ((select public.is_executive()));

drop policy employees_all on public.employees;
create policy employees_all on public.employees for all to authenticated
  using ((select public.is_executive())) with check ((select public.is_executive()));

drop policy shifts_all on public.shifts;
create policy shifts_all on public.shifts for all to authenticated
  using ((select public.is_executive())) with check ((select public.is_executive()));

drop policy audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using ((select public.is_executive()));

drop function public.copy_week(uuid, date, date);
drop table public.store_managers;

create or replace function public.can_manage_store(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_executive()
$$;

-- ---------------------------------------------------------------------------
-- Saving a week: all or nothing.
-- ---------------------------------------------------------------------------

-- p_rows: [{"name": "Ann Lee", "role": "Cashier",
--           "days": [{"date": "2026-11-23", "start": "09:00", "end": "17:00"}, ...]}, ...]
-- Replaces the store's shifts for that week with exactly what was sent.
create or replace function public.save_week(
  p_store uuid, p_week date, p_submitted_by text, p_rows jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  row_item jsonb;
  day_item jsonb;
  emp_id   uuid;
  emp_name text;
  emp_role text;
  d        date;
  saved    integer := 0;
  seen     text[] := '{}';
begin
  if length(trim(coalesce(p_submitted_by, ''))) = 0 then
    raise exception 'Enter your name before saving.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.stores where id = p_store and active) then
    raise exception 'That store was not found.' using errcode = 'P0001';
  end if;

  perform set_config('app.actor_name', trim(p_submitted_by), true);

  delete from public.shifts
  where store_id = p_store and shift_date >= p_week and shift_date < p_week + 7;

  for row_item in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    emp_name := regexp_replace(trim(coalesce(row_item ->> 'name', '')), '\s+', ' ', 'g');
    emp_role := row_item ->> 'role';
    continue when emp_name = '';

    if lower(emp_name) = any (seen) then
      raise exception '% is listed twice. Combine them into one row.', emp_name using errcode = 'P0001';
    end if;
    seen := seen || lower(emp_name);

    insert into public.employees (store_id, full_name, role, active)
    values (p_store, emp_name, emp_role, true)
    on conflict (store_id, lower(trim(full_name)))
      do update set role = excluded.role, active = true, full_name = excluded.full_name
    returning id into emp_id;

    for day_item in select * from jsonb_array_elements(coalesce(row_item -> 'days', '[]'::jsonb)) loop
      d := (day_item ->> 'date')::date;
      if d < p_week or d >= p_week + 7 then
        raise exception 'A shift for % falls outside this week.', emp_name using errcode = 'P0001';
      end if;
      if (day_item ->> 'end')::time <= (day_item ->> 'start')::time then
        raise exception '%: a shift ends before it starts.', emp_name using errcode = 'P0001';
      end if;
      insert into public.shifts (store_id, employee_id, shift_date, start_time, end_time, role)
      values (p_store, emp_id, d, (day_item ->> 'start')::time, (day_item ->> 'end')::time, emp_role);
      saved := saved + 1;
    end loop;
  end loop;

  insert into public.week_submissions (store_id, week_start, submitted_by, submitted_at)
  values (p_store, p_week, trim(p_submitted_by), now())
  on conflict (store_id, week_start)
    do update set submitted_by = excluded.submitted_by, submitted_at = now();

  return saved;
end
$$;

revoke execute on function public.save_week(uuid, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_week(uuid, date, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Reporting, now with hours by role and who submitted.
-- ---------------------------------------------------------------------------

drop view public.shift_details;
create view public.shift_details with (security_invoker = true) as
select
  s.id, s.store_id, st.name as store_name, st.code as store_code, s.employee_id,
  e.full_name as employee_name, s.role,
  s.shift_date, s.start_time, s.end_time, s.break_minutes, s.note,
  public.shift_hours(s) as hours, s.updated_at
from public.shifts s
join public.employees e on e.id = s.employee_id
join public.stores st on st.id = s.store_id;

drop function public.week_summary(date);
create function public.week_summary(week_start date)
returns table (
  store_id uuid, store_name text, store_code text, region text,
  total_hours numeric, cashier_hours numeric, sales_hours numeric, keyholder_hours numeric,
  shift_count bigint, people_scheduled bigint, days_covered bigint,
  submitted_by text, submitted_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select
    st.id, st.name, st.code, st.region,
    coalesce(sum(public.shift_hours(s)), 0),
    coalesce(sum(public.shift_hours(s)) filter (where s.role = 'Cashier'), 0),
    coalesce(sum(public.shift_hours(s)) filter (where s.role = 'Sales Associate'), 0),
    coalesce(sum(public.shift_hours(s)) filter (where s.role = 'Keyholder'), 0),
    count(s.id),
    count(distinct s.employee_id),
    count(distinct s.shift_date),
    ws.submitted_by,
    ws.submitted_at
  from public.stores st
  left join public.shifts s
    on s.store_id = st.id
   and s.shift_date >= week_start
   and s.shift_date < week_start + 7
  left join public.week_submissions ws
    on ws.store_id = st.id and ws.week_start = week_summary.week_start
  where st.active
  group by st.id, ws.submitted_by, ws.submitted_at
  order by st.code nulls last, st.name
$$;
revoke execute on function public.week_summary(date) from public, anon;
grant execute on function public.week_summary(date) to authenticated;
