-- Wodflow — migration 048: judge signup applications
--
-- See docs/plans/2026-08-03-judge-signup-form-design.md. A public,
-- login-free "I'd like to judge this event" form, entirely separate
-- from the profiles-based judge accounts created on the /judges admin
-- page (those are real login credentials for scoring; this is just a
-- volunteer expressing interest ahead of the event). One row per
-- submission — duplicates are allowed on purpose, not worth deduping
-- for a volunteer form.

create table if not exists public.judge_applications (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  first_name     text not null,
  last_name      text not null,
  email          text not null,
  cell           text not null,
  tshirt_size    text not null check (tshirt_size in ('S', 'M', 'L', 'XL', 'XXL')),
  judged_before  boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists judge_applications_event_id_idx on public.judge_applications(event_id);

alter table public.judge_applications enable row level security;

-- Same events-join RLS pattern as event_tickets/registrations. No
-- public/anon select policy — the public form inserts via the
-- service-role client (applicant is anonymous, not signed in) exactly
-- like the ticket/registration purchase flows.
drop policy if exists "judge_applications_select" on public.judge_applications;
drop policy if exists "judge_applications_write" on public.judge_applications;

create policy "judge_applications_select" on public.judge_applications
  for select to authenticated using (
    exists (
      select 1 from public.events e
      where e.id = judge_applications.event_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );

create policy "judge_applications_write" on public.judge_applications
  for all to authenticated using (
    exists (
      select 1 from public.events e
      where e.id = judge_applications.event_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.events e
      where e.id = judge_applications.event_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );
