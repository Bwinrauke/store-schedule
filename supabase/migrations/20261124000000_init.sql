-- Store Schedule: initial schema.
--
-- Two kinds of user:
--   executive  upper management. Sees and edits every store, manages users.
--   manager    store manager. Sees and edits only the stores assigned to them
--              in store_managers.
--
-- Every rule below is enforced by Postgres row-level security, not by the web
-- app, so a manager cannot read another store's schedule even by calling the
-- API directly.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('executive', 'manager');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       public.app_role not null default 'manager',
  created_at timestamptz not null default now()
);

create table public.stores (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  code       text unique,
  region     text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.store_managers (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (store_id, user_id)
);
create index store_managers_user_idx on public.store_managers (user_id);

create table public.employees (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  full_name  text not null check (length(trim(full_name)) > 0),
  position   text not null default 'Sales Associate',
  phone      text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  -- Lets shifts reference (employee, store) together, so a shift can never
  -- put one store's employee on another store's schedule.
  unique (id, store_id)
);
create index employees_store_idx on public.employees (store_id);

create table public.shifts (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  employee_id   uuid not null,
  shift_date    date not null,
  start_time    time not null,
  end_time      time not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 240),
  position      text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles (id) on delete set null,
  foreign key (employee_id, store_id)
    references public.employees (id, store_id) on delete cascade,
  check (end_time > start_time),
  -- One person cannot be booked on two overlapping shifts the same day.
  exclude using gist (
    employee_id with =,
    tsrange(shift_date + start_time, shift_date + end_time) with &&
  )
);
create index shifts_store_date_idx on public.shifts (store_id, shift_date);

-- Paid hours for a shift, net of break.
create or replace function public.shift_hours(s public.shifts)
returns numeric language sql immutable as $$
  select round(
    (extract(epoch from (s.end_time - s.start_time)) / 3600.0
      - s.break_minutes / 60.0)::numeric, 2)
$$;

-- Every change to a schedule, kept for accountability.
create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  store_id   uuid,
  table_name text not null,
  action     text not null,
  row_id     uuid,
  old_row    jsonb,
  new_row    jsonb
);
create index audit_log_store_at_idx on public.audit_log (store_id, at desc);

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies can call them without recursing
-- through RLS on the tables they read.
-- ---------------------------------------------------------------------------

create or replace function public.is_executive()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'executive'
  )
$$;

create or replace function public.can_manage_store(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_executive() or exists (
    select 1 from public.store_managers
    where store_id = target and user_id = auth.uid()
  )
$$;

revoke execute on function public.is_executive() from public, anon;
revoke execute on function public.can_manage_store(uuid) from public, anon;
grant execute on function public.is_executive() to authenticated;
grant execute on function public.can_manage_store(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- New sign-ups get a manager profile with no stores, so they see nothing
-- until an executive assigns them.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_shift()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end
$$;

create trigger shifts_touch
  before insert or update on public.shifts
  for each row execute function public.touch_shift();

create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor, store_id, table_name, action, row_id, old_row, new_row)
  values (
    auth.uid(),
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

create trigger shifts_audit
  after insert or update or delete on public.shifts
  for each row execute function public.write_audit();

create trigger employees_audit
  after insert or update or delete on public.employees
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.stores         enable row level security;
alter table public.store_managers enable row level security;
alter table public.employees      enable row level security;
alter table public.shifts         enable row level security;
alter table public.audit_log      enable row level security;

-- profiles: everyone reads their own; executives read and change all.
-- Nobody can raise their own role, because only executives may update.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_executive());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_executive()) with check (public.is_executive());

-- stores: managers read their stores; executives do everything.
create policy stores_select on public.stores for select to authenticated
  using (public.can_manage_store(id));
create policy stores_write on public.stores for all to authenticated
  using (public.is_executive()) with check (public.is_executive());

-- store_managers: a manager sees their own assignments; executives manage.
create policy store_managers_select on public.store_managers for select to authenticated
  using (user_id = auth.uid() or public.is_executive());
create policy store_managers_write on public.store_managers for all to authenticated
  using (public.is_executive()) with check (public.is_executive());

-- employees and shifts: full access within stores you manage.
create policy employees_all on public.employees for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

create policy shifts_all on public.shifts for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- audit_log: read-only, within stores you manage. Written only by trigger.
create policy audit_select on public.audit_log for select to authenticated
  using (store_id is not null and public.can_manage_store(store_id));

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------

-- Flat shift list with hours, the source for the grid and the exports.
create view public.shift_details with (security_invoker = true) as
select
  s.id, s.store_id, st.name as store_name, s.employee_id,
  e.full_name as employee_name, coalesce(s.position, e.position) as position,
  s.shift_date, s.start_time, s.end_time, s.break_minutes, s.note,
  public.shift_hours(s) as hours, s.updated_at
from public.shifts s
join public.employees e on e.id = s.employee_id
join public.stores st on st.id = s.store_id;

-- One row per store for the week starting week_start: what upper management
-- scans first. Runs as the caller, so RLS still applies.
create or replace function public.week_summary(week_start date)
returns table (
  store_id uuid, store_name text, region text,
  total_hours numeric, shift_count bigint, people_scheduled bigint,
  active_employees bigint, days_covered bigint, last_updated timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select
    st.id, st.name, st.region,
    coalesce(sum(public.shift_hours(s)), 0),
    count(s.id),
    count(distinct s.employee_id),
    (select count(*) from public.employees e where e.store_id = st.id and e.active),
    count(distinct s.shift_date),
    max(s.updated_at)
  from public.stores st
  left join public.shifts s
    on s.store_id = st.id
   and s.shift_date >= week_start
   and s.shift_date < week_start + 7
  where st.active
  group by st.id
  order by st.name
$$;

-- Copy one week's shifts onto another week for a store, skipping inactive
-- employees and anything that would collide. Returns rows copied.
create or replace function public.copy_week(target_store uuid, from_week date, to_week date)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  copied integer := 0;
  src record;
begin
  if not public.can_manage_store(target_store) then
    raise exception 'not allowed to edit this store';
  end if;

  for src in
    select s.* from public.shifts s
    join public.employees e on e.id = s.employee_id and e.active
    where s.store_id = target_store
      and s.shift_date >= from_week and s.shift_date < from_week + 7
  loop
    begin
      insert into public.shifts
        (store_id, employee_id, shift_date, start_time, end_time, break_minutes, position, note)
      values
        (src.store_id, src.employee_id, src.shift_date + (to_week - from_week),
         src.start_time, src.end_time, src.break_minutes, src.position, src.note);
      copied := copied + 1;
    exception when exclusion_violation then
      null; -- already booked then; leave the existing shift alone
    end;
  end loop;
  return copied;
end
$$;

grant execute on function public.week_summary(date) to authenticated;
grant execute on function public.copy_week(uuid, date, date) to authenticated;
revoke execute on function public.copy_week(uuid, date, date) from anon;
revoke execute on function public.week_summary(date) from anon;
