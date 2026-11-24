-- Store managers reach the schedule from a button on the sign-in page, pick
-- their store, and enter that store's 4-digit PIN. The PIN replaces the
-- secret link.
--
-- Both tables are service-role only (RLS on, no policies): the web server
-- checks PINs and records attempts; the public API keys can read neither.
-- PINs are kept readable so upper management can look one up for a manager
-- who forgot it. A 4-digit hash would add nothing, since all 10,000 values
-- can be tried offline in an instant; the real protection is the attempt
-- limit and keeping this table out of reach.

create table public.store_pins (
  store_id   uuid primary key references public.stores (id) on delete cascade,
  pin        text not null check (pin ~ '^[0-9]{4}$'),
  updated_at timestamptz not null default now()
);
alter table public.store_pins enable row level security;

create table public.pin_attempts (
  id       bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  ip       text not null,
  ok       boolean not null,
  at       timestamptz not null default now()
);
create index pin_attempts_store_at_idx on public.pin_attempts (store_id, at desc);
alter table public.pin_attempts enable row level security;

-- Signs the "this phone entered the PIN" cookie.
insert into public.app_settings (key, value)
values ('cookie_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- The secret link is retired.
delete from public.app_settings where key = 'manager_link_token';
