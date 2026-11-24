\set ON_ERROR_STOP on
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into auth.users (id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000e','exec@x','{"full_name":"Exec"}'),
 ('00000000-0000-0000-0000-00000000000a','mgr.a@x','{}'),
 ('00000000-0000-0000-0000-00000000000b','mgr.b@x','{}');
update public.profiles set role='executive' where email='exec@x';
insert into public.stores (id,name) values
 ('10000000-0000-0000-0000-00000000000a','Store A'),('10000000-0000-0000-0000-00000000000b','Store B');
insert into public.store_managers values
 ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a'),
 ('10000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000b');
insert into public.employees (id,store_id,full_name) values
 ('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','Ann'),
 ('20000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b','Bob');

-- Manager A
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.stores) = 1, 'A sees only own store';
  assert (select count(*) from public.employees) = 1, 'A sees only own employees';
  assert (select count(*) from public.profiles) = 1, 'A sees only own profile';
end $$;
insert into public.shifts (store_id,employee_id,shift_date,start_time,end_time,break_minutes)
 values ('10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a','2026-11-22','09:00','17:30',30);
do $$ begin
  assert (select hours from public.shift_details) = 8.00, 'hours net of break';
  assert (select updated_by from public.shifts) = '00000000-0000-0000-0000-00000000000a', 'updated_by stamped';
end $$;
-- blocked: write to store B
do $$ begin
  begin insert into public.shifts (store_id,employee_id,shift_date,start_time,end_time)
    values ('10000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-00000000000b','2026-11-22','09:00','17:00');
    raise exception 'FAIL: A wrote to store B';
  exception when insufficient_privilege then null; end;
  -- blocked: put B's employee on A's schedule (FK; RLS hides row so FK check still fires)
  begin insert into public.shifts (store_id,employee_id,shift_date,start_time,end_time)
    values ('10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000b','2026-11-22','09:00','17:00');
    raise exception 'FAIL: cross-store employee';
  exception when foreign_key_violation then null; end;
  -- blocked: overlapping shift
  begin insert into public.shifts (store_id,employee_id,shift_date,start_time,end_time)
    values ('10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a','2026-11-22','17:00','20:00');
    raise exception 'FAIL: overlap allowed';
  exception when exclusion_violation then null; end;
  -- blocked: self-promotion (update silently matches 0 rows)
  update public.profiles set role='executive' where id=auth.uid();
  assert not public.is_executive(), 'FAIL: self-promotion';
  -- copy week
  assert public.copy_week('10000000-0000-0000-0000-00000000000a','2026-11-22','2026-11-29') = 1, 'copy 1';
  assert public.copy_week('10000000-0000-0000-0000-00000000000a','2026-11-22','2026-11-29') = 0, 'copy idempotent';
  begin perform public.copy_week('10000000-0000-0000-0000-00000000000b','2026-11-22','2026-11-29');
    raise exception 'FAIL: copy other store';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  assert (select count(*) from public.audit_log) = 3, 'audit: 1 employee + 2 shifts in own store';
  assert (select count(*) from public.week_summary('2026-11-22')) = 1, 'summary scoped';
end $$;

-- Manager B sees nothing of A
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.shifts) = 0, 'B cannot see A shifts';
  assert (select count(*) from public.audit_log where store_id <> '10000000-0000-0000-0000-00000000000b') = 0 and (select count(*) from public.audit_log) = 1, 'B sees only own audit';
end $$;

-- Executive sees all
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
do $$ begin
  assert (select count(*) from public.week_summary('2026-11-22')) = 2, 'exec sees all stores';
  assert (select total_hours from public.week_summary('2026-11-22') where store_name='Store A') = 8.00, 'exec totals';
  assert (select count(*) from public.profiles) = 3, 'exec sees all profiles';
end $$;
-- anon sees nothing
reset role; set role anon;
do $$ begin
  begin perform count(*) from public.shifts; raise exception 'FAIL anon';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo ALL RLS TESTS PASSED
