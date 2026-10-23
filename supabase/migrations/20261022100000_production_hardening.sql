-- Safe to run after the initial and profile/project migrations.

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role then
    raise exception 'Account roles cannot be changed after signup';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
before update on public.profiles
for each row execute function public.prevent_profile_role_change();

create index if not exists projects_status_idx on public.projects(status);
create index if not exists applications_project_status_idx on public.applications(project_id, status);
create index if not exists applications_created_at_idx on public.applications(created_at desc);

grant usage on schema public to authenticated;
grant select, insert, update on public.applications to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, update on public.profiles to authenticated;

drop policy if exists "Students can delete their own documents" on storage.objects;
create policy "Students can delete their own documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'student-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
