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
    '[{"name":"Ann  Lee","role":"Cashier","days":[
        {"date":"2026-11-22","start":"09:00","end":"17:00"},
        {"date":"2026-11-23","start":"12:00","end":"16:30"}]},
      {"name":"Bob","role":"Keyholder","days":[{"date":"2026-11-22","start":"13:00","end":"21:00"}]},
      {"name":"   ","role":"Cashier","days":[]}]') = 3, 'saved 3 shifts, blank row skipped';
  assert (select full_name from public.employees where role = 'Cashier') = 'Ann Lee', 'name whitespace normalised';

  -- Resubmitting replaces the week, and the same person (any casing) is reused.
  assert public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'Maria',
    '[{"name":"ann lee","role":"Sales Associate","days":[{"date":"2026-11-24","start":"10:00","end":"18:00"}]}]') = 1, 'resubmit';
  assert (select count(*) from public.shifts) = 1, 'old shifts replaced';
  assert (select count(*) from public.employees) = 2, 'no duplicate employee';
  assert (select role from public.employees where lower(full_name) = 'ann lee') = 'Sales Associate', 'role updated';
  assert (select actor_name from public.audit_log order by id desc limit 1) = 'Maria', 'audit records submitter';
end $$;

do $$ begin
  begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'M',
      '[{"name":"Zed","role":"Manager","days":[{"date":"2026-11-22","start":"09:00","end":"17:00"}]}]');
    raise exception 'FAIL: bad role accepted';
  exception when check_violation then null; end;
  begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'M',
      '[{"name":"Ann Lee","role":"Cashier","days":[]},{"name":"ANN LEE","role":"Cashier","days":[]}]');
    raise exception 'FAIL: duplicate name accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'M',
      '[{"name":"Ann Lee","role":"Cashier","days":[{"date":"2026-12-05","start":"09:00","end":"17:00"}]}]');
    raise exception 'FAIL: out-of-week date accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', 'M',
      '[{"name":"Ann Lee","role":"Cashier","days":[{"date":"2026-11-22","start":"17:00","end":"09:00"}]}]');
    raise exception 'FAIL: backwards shift accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.save_week('10000000-0000-0000-0000-00000000000a', '2026-11-22', '  ', '[]');
    raise exception 'FAIL: blank submitter accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- A failed save must leave the previous week intact.
  assert (select count(*) from public.shifts) = 1, 'failed saves roll back';
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
  assert r.total_hours = 8 and r.sales_hours = 8 and r.cashier_hours = 0, 'role hours';
  assert r.submitted_by = 'Maria', 'submitter shown';
  assert (select count(*) from public.week_summary('2026-11-22')) = 2, 'all stores listed';
  assert (select submitted_by from public.week_summary('2026-11-22') where store_code = '102') is null, 'unsubmitted store';
  assert (select count(*) from public.app_settings) = 0, 'even executives read the secret only via the server';
end $$;
reset role;
\echo ALL TESTS PASSED
