-- Every employee on a schedule has a VRP user code. Managers enter it with
-- each shift; it's stored on the employee and shown to upper management.

alter table public.employees
  add column vrp_code text
  check (vrp_code ~ '^[A-Za-z0-9]{1,20}$');

-- p_shifts items now also carry "code". Within one submission a person has
-- one code, and two people can't share a code.
create or replace function public.save_week(
  p_store uuid, p_week date, p_submitted_by text, p_shifts jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  item     jsonb;
  emp_id   uuid;
  emp_name text;
  emp_role text;
  emp_code text;
  d        date;
  saved    integer := 0;
  clash    record;
begin
  if length(trim(coalesce(p_submitted_by, ''))) = 0 then
    raise exception 'Enter your name before saving.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.stores where id = p_store and active) then
    raise exception 'That store was not found.' using errcode = 'P0001';
  end if;

  -- One code per person, one person per code, across the whole week.
  select a.n1, a.n2, a.c into clash from (
    select lower(trim(x ->> 'name')) n1, lower(trim(y ->> 'name')) n2, upper(trim(x ->> 'code')) c
    from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb)) x
    join jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb)) y
      on upper(trim(x ->> 'code')) = upper(trim(y ->> 'code'))
     and regexp_replace(lower(trim(x ->> 'name')), '\s+', ' ', 'g')
      <> regexp_replace(lower(trim(y ->> 'name')), '\s+', ' ', 'g')
  ) a limit 1;
  if found then
    raise exception 'VRP code % is entered for two different people.', clash.c using errcode = 'P0001';
  end if;
  select a.n into clash from (
    select regexp_replace(lower(trim(x ->> 'name')), '\s+', ' ', 'g') n
    from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb)) x
    group by 1 having count(distinct upper(trim(x ->> 'code'))) > 1
  ) a limit 1;
  if found then
    raise exception '% has more than one VRP code this week.', clash.n using errcode = 'P0001';
  end if;

  perform set_config('app.actor_name', trim(p_submitted_by), true);

  delete from public.shifts
  where store_id = p_store and shift_date >= p_week and shift_date < p_week + 7;

  for item in
    select value from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb))
    order by value ->> 'date', value ->> 'start'
  loop
    emp_name := regexp_replace(trim(coalesce(item ->> 'name', '')), '\s+', ' ', 'g');
    emp_role := item ->> 'role';
    emp_code := upper(trim(coalesce(item ->> 'code', '')));
    if emp_name = '' then
      raise exception 'Every shift needs an employee name.' using errcode = 'P0001';
    end if;
    if emp_code = '' then
      raise exception '% needs a VRP user code.', emp_name using errcode = 'P0001';
    end if;

    d := (item ->> 'date')::date;
    if d < p_week or d >= p_week + 7 then
      raise exception 'A shift for % falls outside this week.', emp_name using errcode = 'P0001';
    end if;
    if coalesce(item ->> 'start', '') = '' or coalesce(item ->> 'end', '') = '' then
      raise exception '% needs a time in and a time out.', emp_name using errcode = 'P0001';
    end if;
    if (item ->> 'end')::time <= (item ->> 'start')::time then
      raise exception '%: time out is before time in.', emp_name using errcode = 'P0001';
    end if;

    insert into public.employees (store_id, full_name, role, vrp_code, active)
    values (p_store, emp_name, emp_role, emp_code, true)
    on conflict (store_id, lower(trim(full_name)))
      do update set role = excluded.role, vrp_code = excluded.vrp_code, active = true, full_name = excluded.full_name
    returning id into emp_id;

    begin
      insert into public.shifts (store_id, employee_id, shift_date, start_time, end_time, role)
      values (p_store, emp_id, d, (item ->> 'start')::time, (item ->> 'end')::time, emp_role);
    exception when exclusion_violation then
      raise exception '% is scheduled twice at overlapping times on %.',
        emp_name, to_char(d, 'FMDay, Mon FMDD') using errcode = 'P0001';
    end;
    saved := saved + 1;
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

-- Reporting picks up the code.
drop view public.shift_details;
create view public.shift_details with (security_invoker = true) as
select
  s.id, s.store_id, st.name as store_name, st.code as store_code, s.employee_id,
  e.full_name as employee_name, e.vrp_code, s.role,
  s.shift_date, s.start_time, s.end_time, s.break_minutes, s.note,
  public.shift_hours(s) as hours, s.updated_at
from public.shifts s
join public.employees e on e.id = s.employee_id
join public.stores st on st.id = s.store_id;
