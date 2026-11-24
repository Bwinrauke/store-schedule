-- Hardening from the Supabase security and performance advisors.

-- Trigger functions are never meant to be called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.write_audit() from public, anon, authenticated;
revoke execute on function public.touch_shift() from public, anon, authenticated;

-- Keep extensions out of the API-exposed schema.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;

alter function public.shift_hours(public.shifts) set search_path = '';

-- Evaluate auth.uid() once per query rather than per row.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_executive()));

-- One permissive policy per action, so reads are not checked twice.
drop policy stores_write on public.stores;
create policy stores_insert on public.stores for insert to authenticated
  with check ((select public.is_executive()));
create policy stores_update on public.stores for update to authenticated
  using ((select public.is_executive())) with check ((select public.is_executive()));
create policy stores_delete on public.stores for delete to authenticated
  using ((select public.is_executive()));

drop policy store_managers_select on public.store_managers;
drop policy store_managers_write on public.store_managers;
create policy store_managers_select on public.store_managers for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_executive()));
create policy store_managers_insert on public.store_managers for insert to authenticated
  with check ((select public.is_executive()));
create policy store_managers_update on public.store_managers for update to authenticated
  using ((select public.is_executive())) with check ((select public.is_executive()));
create policy store_managers_delete on public.store_managers for delete to authenticated
  using ((select public.is_executive()));

create index if not exists shifts_employee_store_idx on public.shifts (employee_id, store_id);
create index if not exists shifts_updated_by_idx on public.shifts (updated_by);
