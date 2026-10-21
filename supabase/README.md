# Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project API settings.
4. Run `supabase/migrations/20261021120000_initial_schema.sql` in the Supabase SQL editor.
5. Enable email authentication in Authentication > Providers.

The migration creates student and employer profiles, projects, applications, status transitions, and Row Level Security policies. Never put a service-role key in `.env.local` or browser code.
