# Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project API settings.
4. For a brand-new project only, run `supabase/migrations/20261021120000_initial_schema.sql` in the Supabase SQL editor.
5. Enable email authentication in Authentication > Providers.

The migration creates student and employer profiles, projects, applications, status transitions, and Row Level Security policies. Never put a service-role key in `.env.local` or browser code.

Once the migrations are applied, signed-in users automatically use Supabase for project loading, project publishing, applications, profile updates, resume storage, and application status updates. When Supabase variables are present, the frontend does not silently switch to local data: it shows a setup error until the live schema is available.

## Live workflow checklist

After applying the migration:

1. Create one student account and one business account from the app.
2. Confirm both accounts receive a profile row in `public.profiles`.
3. Sign in as the business and publish a project.
4. Sign in as the student, search for the project, and submit an application.
5. Sign in as the business and move the application from `submitted` to `shortlisted` or `accepted`.
6. Sign in as the student again and verify the status is updated.

The database policies—not only the frontend—enforce role-specific project and application access. The local demo mode is intended for UI evaluation only and does not provide shared data between browsers.

For an existing project, do not rerun the initial migration. It creates the
`user_role` and `application_status` enum types and the core tables only once.
Rerunning it produces errors such as `type "user_role" already exists`.

Instead, run these migrations in filename order:

```text
20261021150000_profiles_and_project_management.sql
20261022100000_production_hardening.sql
```

They add editable profile fields, live/closed project status, applicant counts,
owner-only project management, immutable account roles, indexes, and document
cleanup policies. Editing a migration file does not rerun SQL on an already
initialized Supabase project.

To confirm whether the initial schema is already present, run:

```sql
select
  to_regclass('public.profiles') as profiles_table,
  to_regclass('public.projects') as projects_table,
  to_regclass('public.applications') as applications_table,
  exists (
    select 1 from pg_type
    where typname = 'user_role'
      and typnamespace = 'public'::regnamespace
  ) as user_role_exists,
  exists (
    select 1 from pg_type
    where typname = 'application_status'
      and typnamespace = 'public'::regnamespace
  ) as application_status_exists;
```

If the three tables and both enum values exist, skip
`20261021120000_initial_schema.sql` and run only the two extension migrations.

After running the SQL, refresh the Vite app. In the browser console, the setup
banner should disappear and the workflow should be tested with two separate
accounts:

1. Sign up as a business and publish a project.
2. Sign up as a student and apply once.
3. Return to the business account and open applicants.
4. Shortlist or accept the student.
5. Return to the student account and confirm the status appears under
   **My applications**.

## Inspecting data from VS Code

The browser uses the publishable key, so it cannot safely expose unrestricted
database browsing. To inspect data in VS Code, install a PostgreSQL/Supabase
database extension, connect with the Supabase **direct database connection**
from Project Settings > Database, and run queries in the extension's SQL editor:

```sql
select id, full_name, role, industry, github, linkedin, resume_name
from public.profiles
order by created_at desc;

select id, title, industry, work_mode, location, compensation, status
from public.projects
order by created_at desc;
```

Never place the database password or service-role key in `.env.local` or
frontend code. The VS Code connection should be stored in the extension's
secure credential store.

## Vercel deployment

The project is a standard Vite single-page application. Deploy the repository
with these Vercel settings:

```text
Framework preset: Vite
Build command: npm run build
Output directory: dist
Install command: npm install
Root directory: .
```

Add these environment variables in Vercel Project Settings → Environment
Variables for **Production**, **Preview**, and **Development**:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

Use the publishable/anonymous Supabase key only. Never add the Supabase
service-role key to Vercel client-side environment variables.

After the first deployment:

1. Copy the Vercel production URL.
2. In Supabase, open Authentication → URL Configuration.
3. Set the production URL as the Site URL.
4. Add the production URL and its password-recovery callback URL to Redirect
   URLs. The app uses the site root for password recovery.
5. Create or use separate student and business accounts and repeat the
   publish → apply → accept → tracking workflow.
6. Confirm the browser shows **Backend connected**, not **Local mode** or
   **API connected · schema update required**.
