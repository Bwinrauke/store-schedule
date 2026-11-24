# Store Schedule

Weekly employee schedules for every store, in one place.

- **Store managers** build their store's week in a simple grid: click a day to
  add a shift, pick a preset (Open / Mid / Close), save. Copy last week in one
  click, print it for the back room, or export it to CSV.
- **Upper management** gets an overview of every store for any week: scheduled
  hours, change vs last week, staff scheduled, days with nobody on, which
  stores haven't built their week yet, and who is working today. Click through
  to any store's full grid.
- **Admin** (upper management only): add stores, add people, choose who is a
  store manager vs upper management, and which stores each manager runs.

Next.js 15 on Vercel, Supabase (Postgres) for data and sign-in.

## Why the backend is trustworthy

All access rules live in the database (`supabase/migrations/`), not the web
page, so they hold even against someone calling the API directly:

- A manager can only read or change the stores assigned to them.
  Upper management sees and edits everything.
- Nobody can promote themselves; only upper management can change roles.
- A shift can't put one store's employee on another store's schedule.
- The database refuses double-booking the same person at overlapping times,
  and shifts that end before they start.
- Every shift and employee change is written to `audit_log` with who did it
  and when, before and after.
- Only invited people can sign in; there is no public sign-up.

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

Import the repo, add the variables from `.env.example`
(Supabase → Settings → API), and deploy.

### 4. First run

1. Admin → add your stores.
2. Admin → add each store manager with their store.
3. Managers sign in at the site with their email (a link is emailed), add
   their employees, and build the week.

## Local development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

## Testing

```bash
npm test          # date/time and hours math
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
  -f supabase/tests/rls_test.sql
# → ALL RLS TESTS PASSED
```

`shim.sql` stands in for Supabase's `auth` schema; never run it on the real
project.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_WEEK_STARTS_ON` | `0` | `0` Sunday, `1` Monday |
| `NEXT_PUBLIC_TIMEZONE` | `America/New_York` | What "today" means |

Overtime is flagged at more than 40 scheduled hours in the week.
