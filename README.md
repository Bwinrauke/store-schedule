# Store Schedule

Weekly employee schedules for every store, in one place.

- **Store managers** need no account. They open one private link, type their
  store number (or pick the store from a list), then go **day by day**: for
  each day, add who's working with their name, role (Cashier, Sales Associate
  or Keyholder), and start and end time (8:00 AM–9:00 PM, 15-minute steps).
  The day tabs show how many people and hours each day has, "Copy Monday's
  shifts" fills a day from the one before, and a running list shows each
  person's hours for the week. They type their own name once and press
  **Save week**. Next week, **Start from last week** fills it all in.
- **Upper management** signs in and gets an overview of every store for any
  week: hours by role, total vs last week, who submitted and when, which
  stores haven't submitted, days with nobody on, and who is working today.
  Click through to any store's week, or export to CSV.
- **Admin**: the managers' link (copy it, or replace it if it leaks), stores,
  and upper-management logins.

Next.js 15 on Vercel, Supabase (Postgres) for data and sign-in.

## Why the backend is trustworthy

All access rules live in the database (`supabase/migrations/`), not the web
page, so they hold even against someone calling the API directly:

- The public API key can read and write nothing. Managers' saves go through
  the web server, which checks the link's secret on every save, then calls one
  database function that saves the whole week or nothing.
- Only signed-in upper management can read schedules. Nobody can promote
  themselves; there is no public sign-up.
- Roles are a fixed list, shifts must end after they start, the same person
  can't be double-booked, and the same name maps to one employee per store
  (any capitalisation).
- Every change is written to `audit_log` with who made it (the manager's typed
  name, or the signed-in user) and the before and after.

These rules are tested: `supabase/tests/rls_test.sql` runs against a real
Postgres and checks each one (see *Testing*).

## Set up

### 1. Supabase

1. Create a project at supabase.com.
2. **SQL Editor** → run each file in `supabase/migrations/`, in name order.
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to
   sign up". People are added from the Admin page instead.
4. **Authentication → URL Configuration**: set **Site URL** to your Vercel URL
   and add `https://YOUR-SITE/auth/callback` to **Redirect URLs**
   (and `http://localhost:3000/auth/callback` for local work).

### 2. Make yourself the first executive

**Authentication → Users → Add user** with your email (tick *Auto Confirm*).
Then in the SQL Editor:

```sql
update public.profiles set role = 'executive', full_name = 'Your Name'
where email = 'you@example.com';
```

From then on, add everyone else from the app's **Admin** page.

### 3. Deploy on Vercel

Import the repo into Vercel. Then either link the Supabase project to it
through the Supabase ↔ Vercel integration (it fills in the keys), or add the
variables from `.env.example` by hand (Supabase → Settings → API). Redeploy
after the keys are in place.

### 4. First run

1. Admin → add your stores, each with its store number.
2. Admin → copy the store manager link and send it to your managers.
3. Managers open it, pick their store, and enter the week.

## Local development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

## Testing

```bash
npm test          # dates, hours, and the manager form checks
npm run typecheck
```

Database rules, against any scratch Postgres 15+:

```bash
createdb schedule_test
psql -d schedule_test -c 'create schema extensions'
psql -d schedule_test -v ON_ERROR_STOP=1 \
  -f supabase/tests/shim.sql \
  -f supabase/migrations/20261124000000_init.sql \
  -f supabase/migrations/20261124000100_harden.sql \
  -f supabase/migrations/20261124000200_link_access.sql \
  -f supabase/migrations/20261124000300_business_hours.sql \
  -f supabase/migrations/20261124000400_save_week_by_shift.sql \
  -f supabase/tests/rls_test.sql
# → ALL TESTS PASSED
```

`shim.sql` stands in for Supabase's `auth` schema; never run it on the real
project.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_WEEK_STARTS_ON` | `0` | `0` Sunday, `1` Monday |
| `NEXT_PUBLIC_TIMEZONE` | `America/New_York` | What "today" means |
| `NEXT_PUBLIC_SITE_URL` | production domain | Address used in the managers' link |

The managers' link always uses the production domain (Vercel's
`VERCEL_PROJECT_PRODUCTION_URL`, which becomes your custom domain once one is
attached). Vercel's per-deployment addresses ask visitors to log in to
Vercel, so a link built from one would lock managers out.

Overtime is flagged at more than 40 scheduled hours in the week.
