-- Run once on a brand-new Supabase project.
-- For an existing project, skip this file; rerunning it causes
-- "type user_role already exists" and duplicate-object errors.

create type public.user_role as enum ('student', 'employer');
create type public.application_status as enum ('submitted', 'shortlisted', 'accepted', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 2000),
  skills text[] not null default '{}',
  duration text not null,
  status text not null default 'live' check (status in ('live', 'closed')),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default now(),
  unique (project_id, student_id)
);

create index projects_employer_id_idx on public.projects(employer_id);
create index applications_project_id_idx on public.applications(project_id);
create index applications_student_id_idx on public.applications(student_id);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.applications enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.projects to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert, update on public.projects to authenticated;
grant select, insert, update on public.applications to authenticated;

create policy "Profiles are visible to authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Live projects are visible to authenticated users"
  on public.projects for select to authenticated
  using (status = 'live' or employer_id = auth.uid());

create policy "Employers can publish projects"
  on public.projects for insert to authenticated
  with check (
    employer_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'employer'
    )
  );

create policy "Employers can update their projects"
  on public.projects for update to authenticated
  using (employer_id = auth.uid())
  with check (employer_id = auth.uid());

create policy "Students can submit applications"
  on public.applications for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'student'
    )
  );

create policy "Students and project employers can view applications"
  on public.applications for select to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.projects
      where projects.id = applications.project_id
        and projects.employer_id = auth.uid()
    )
  );

create policy "Project employers can update application status"
  on public.applications for update to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = applications.project_id
        and projects.employer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = applications.project_id
        and projects.employer_id = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'SkillBridge member'),
    case
      when new.raw_user_meta_data ->> 'role' = 'employer' then 'employer'::public.user_role
      else 'student'::public.user_role
    end
  );
  return new;
end;
$$;

create or replace function public.prevent_application_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.project_id <> old.project_id or new.student_id <> old.student_id then
    raise exception 'Application ownership cannot be changed';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger applications_identity_guard
  before update on public.applications
  for each row execute procedure public.prevent_application_identity_change();
