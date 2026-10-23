alter table public.profiles
  add column if not exists bio text not null default '',
  add column if not exists skills text[] not null default '{}',
  add column if not exists education text not null default '',
  add column if not exists website text not null default '',
  add column if not exists github text not null default '',
  add column if not exists linkedin text not null default '',
  add column if not exists resume_path text not null default '',
  add column if not exists resume_name text not null default '',
  add column if not exists industry text not null default '',
  add column if not exists updated_at timestamptz not null default now();

alter table public.projects
  add column if not exists status text not null default 'live'
    check (status in ('live', 'closed'));

alter table public.projects
  add column if not exists industry text not null default '',
  add column if not exists work_mode text not null default 'Remote',
  add column if not exists location text not null default '',
  add column if not exists compensation text not null default '';

insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', false)
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "Employers can update their projects" on public.projects;
create policy "Employers can update their projects"
on public.projects for update to authenticated
using (employer_id = auth.uid())
with check (employer_id = auth.uid());

drop policy if exists "Students can upload their own documents" on storage.objects;
create policy "Students can upload their own documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
);

drop policy if exists "Students and employers can read student documents" on storage.objects;
create policy "Students and employers can read student documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'student-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.applications a
      join public.projects p on p.id = a.project_id
      where p.employer_id = auth.uid()
        and a.student_id::text = (storage.foldername(name))[1]
    )
  )
);

drop policy if exists "Students can update their own documents" on storage.objects;
create policy "Students can update their own documents"
on storage.objects for update to authenticated
using (bucket_id = 'student-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'student-documents' and (storage.foldername(name))[1] = auth.uid()::text);

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.projects to authenticated;
