\set ON_ERROR_STOP on
-- Supabase grants table privileges to these roles by default; RLS does the rest.
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000e', 'exec@x', '{"full_name":"Exec"}'),
  ('00000000-0000-0000-0000-00000000000f', 'nobody@x', '{}');
update public.profiles set role = 'executive' where email = 'exec@x';
insert into public.stores (id, name, code) values
  ('10000000-0000-0000-0000-00000000000a', 'Downtown', '101'),
  ('10000000-0000-0000-0000-00000000000b', 'Mall', '102');

-- ---- Manager submission (the web server runs this as service_role) ------
set role service_role;
do $$ begin
  assert public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'Maria',
    '[{"name":"Ann  Lee","role":"Cashier","date":"2026-11-22","start":"09:00","end":"17:00"},
      {"name":"Ann Lee","role":"Keyholder","date":"2026-11-23","start":"12:00","end":"16:30"},
      {"name":"Bob","role":"Keyholder","date":"2026-11-22","start":"13:00","end":"21:00"}]') = 3, 'saved 3 shifts';
  assert (select count(*) from public.employees) = 2, 'Ann reused across days';
  assert (select full_name from public.employees where lower(full_name) = 'ann lee') = 'Ann Lee', 'name whitespace normalised';
  assert (select role from public.shifts where shift_date = '2026-11-22' and start_time = '09:00') = 'Cashier', 'role kept per shift';
  assert (select role from public.shifts where shift_date = '2026-11-23') = 'Keyholder', 'different role another day';
  assert (select role from public.employees where lower(full_name) = 'ann lee') = 'Keyholder', 'employee keeps latest role';

  -- A split shift on the same day is fine as long as it doesn't overlap.
  assert public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'Maria',
    '[{"name":"ann lee","role":"Sales Associate","date":"2026-11-24","start":"08:00","end":"12:00"},
      {"name":"Ann Lee","role":"Sales Associate","date":"2026-11-24","start":"13:00","end":"17:00"}]') = 2, 'resubmit with split shift';
  assert (select count(*) from public.shifts) = 2, 'old shifts replaced';
  assert (select count(*) from public.employees) = 2, 'no duplicate employee';
  assert (select actor_name from public.audit_log order by id desc limit 1) = 'Maria', 'audit records submitter';
end $$;

do $$
declare
  bad text[] := array[
    '[{"name":"Zed","role":"Manager","date":"2026-11-22","start":"09:00","end":"17:00"}]',
    '[{"name":"Ann Lee","role":"Cashier","date":"2026-11-22","start":"07:45","end":"12:00"}]',
    '[{"name":"Ann Lee","role":"Cashier","date":"2026-11-22","start":"13:00","end":"21:15"}]',
    '[{"name":"Ann Lee","role":"Cashier","date":"2026-11-22","start":"09:10","end":"12:00"}]'];
  b text;
begin
  foreach b in array bad loop
    begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'M', b::jsonb);
      raise exception 'FAIL: accepted %', b;
    exception when check_violation then null; end;
  end loop;

  -- Friendly errors raised by save_week itself.
  bad := array[
    '[{"name":"Ann Lee","role":"Cashier","date":"2026-11-22","start":"09:00","end":"13:00"},
      {"name":"ANN LEE","role":"Cashier","date":"2026-11-22","start":"12:00","end":"16:00"}]',
    '[{"name":"Ann Lee","role":"Cashier","date":"2026-12-05","start":"09:00","end":"17:00"}]',
    '[{"name":"Ann Lee","role":"Cashier","date":"2026-11-22","start":"17:00","end":"09:00"}]',
    '[{"name":"  ","role":"Cashier","date":"2026-11-22","start":"09:00","end":"17:00"}]'];
  foreach b in array bad loop
    begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'M', b::jsonb);
      raise exception 'FAIL: accepted %', b;
    exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  end loop;
  begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', '  ', '[]');
    raise exception 'FAIL: blank submitter accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- A failed save must leave the previous week intact.
  assert (select count(*) from public.shifts) = 2, 'failed saves roll back';
end $$;

-- Overlap message names the person and the day.
do $$ begin
  perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'M',
    '[{"name":"Ann Lee","role":"Cashier","date":"2026-11-23","start":"09:00","end":"13:00"},
      {"name":"Ann Lee","role":"Cashier","date":"2026-11-23","start":"12:00","end":"16:00"}]');
  raise exception 'FAIL: overlap accepted';
exception when raise_exception then
  assert sqlerrm = 'Ann Lee is scheduled twice at overlapping times on Monday, Nov 23.', sqlerrm;
end $$;

-- ---- The public API key (anon) can do nothing ---------------------------
reset role; set role anon;
do $$ begin
  assert (select count(*) from public.stores) = 0, 'anon reads no stores';
  assert (select count(*) from public.shifts) = 0, 'anon reads no shifts';
  assert (select count(*) from public.app_settings) = 0, 'anon cannot read the link secret';
  begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'x', '[]');
    raise exception 'FAIL: anon can save';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- A signed-in non-executive sees nothing -----------------------------
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
do $$ begin
  assert (select count(*) from public.stores) = 0, 'no-access user reads no stores';
  assert (select count(*) from public.week_summary('2026-11-22')) = 0, 'no-access user gets no summary';
  assert (select count(*) from public.app_settings) = 0, 'no-access user cannot read secret';
  update public.profiles set role = 'executive' where id = auth.uid();
  assert not public.is_executive(), 'FAIL: self-promotion';
  begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'x', '[]');
    raise exception 'FAIL: signed-in user can save via API';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- Upper management sees everything -----------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
do $$ declare r record; begin
  select * into r from public.week_summary('2026-11-22') where store_code = '101';
  assert r.total_hours = 8 and r.sales_hours = 8 and r.cashier_hours = 0 and r.keyholder_hours = 0, 'role hours';
  assert r.submitted_by = 'Maria', 'submitter shown';
  assert (select count(*) from public.week_summary('2026-11-22')) = 2, 'all stores listed';
  assert (select submitted_by from public.week_summary('2026-11-22') where store_code = '102') is null, 'unsubmitted store';
  assert (select count(*) from public.app_settings) = 0, 'even executives read the secret only via the server';
end $$;
reset role;
\echo ALL TESTS PASSED
