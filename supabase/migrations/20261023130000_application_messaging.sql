-- Enables private messages between a student and the business attached to an application.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_application_created_idx
  on public.messages(application_id, created_at);

alter table public.messages enable row level security;
grant select, insert, update on public.messages to authenticated;

drop policy if exists "Application participants can read messages" on public.messages;
create policy "Application participants can read messages"
on public.messages for select to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
);

drop policy if exists "Application participants can send messages" on public.messages;
create policy "Application participants can send messages"
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    exists (
      select 1 from public.applications a
      where a.id = application_id and a.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.applications a
      join public.projects p on p.id = a.project_id
      where a.id = application_id and p.employer_id = auth.uid()
    )
  )
  and (
    recipient_id = (
      select a.student_id from public.applications a where a.id = application_id
    )
    or recipient_id = (
      select p.employer_id
      from public.applications a
      join public.projects p on p.id = a.project_id
      where a.id = application_id
    )
  )
);

drop policy if exists "Recipients can mark messages read" on public.messages;
create policy "Recipients can mark messages read"
on public.messages for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());
