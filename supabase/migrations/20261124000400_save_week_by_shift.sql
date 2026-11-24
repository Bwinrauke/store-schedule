-- Managers now fill the schedule in day by day, so save_week takes a flat
-- list of shifts, each with its own role. Someone can be a Cashier on Monday
-- and a Keyholder on Tuesday.
--
-- p_shifts: [{"name": "Ann Lee", "role": "Cashier", "date": "2026-11-23",
--             "start": "09:00", "end": "17:00"}, ...]
-- Replaces the store's shifts for that week with exactly what was sent, all
-- or nothing.

drop function public.save_week(uuid, date, text, jsonb);

create function public.save_week(
  p_store uuid, p_week date, p_submitted_by text, p_shifts jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  item     jsonb;
  emp_id   uuid;
  emp_name text;
  emp_role text;
  d        date;
  saved    integer := 0;
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

  -- Oldest dates first, so an employee's saved role is the one they work last.
  for item in
    select value from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb))
    order by value ->> 'date', value ->> 'start'
  loop
    emp_name := regexp_replace(trim(coalesce(item ->> 'name', '')), '\s+', ' ', 'g');
    emp_role := item ->> 'role';
    if emp_name = '' then
      raise exception 'Every shift needs an employee name.' using errcode = 'P0001';
    end if;

    d := (item ->> 'date')::date;
    if d < p_week or d >= p_week + 7 then
      raise exception 'A shift for % falls outside this week.', emp_name using errcode = 'P0001';
    end if;
    if (item ->> 'end')::time <= (item ->> 'start')::time then
      raise exception '%: a shift ends before it starts.', emp_name using errcode = 'P0001';
    end if;

    insert into public.employees (store_id, full_name, role, active)
    values (p_store, emp_name, emp_role, true)
    on conflict (store_id, lower(trim(full_name)))
      do update set role = excluded.role, active = true, full_name = excluded.full_name
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
