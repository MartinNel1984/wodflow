-- Wodflow — migration 067: email_log
--
-- Until now there was no record of whether a confirmation email
-- actually sent — lib/email.ts only console.error'd on failure, with
-- nothing persisted. A real support case (2026-08-13, "Pair Pressure"
-- team, paid but never got their confirmation) had no way to be
-- checked after the fact; had to build a one-off diagnostic route to
-- force a resend. This table gives every send attempt a row so that
-- can be a lookup instead of an investigation, and lets the athletes
-- page show a "Confirmation email sent" indicator next to Payment.
--
-- Explicit `revoke all ... then grant select only` per the lesson in
-- migration-066 — Supabase's default-privilege scaffold grants ALL to
-- anon/authenticated on new objects, not just what's explicitly
-- granted, so a bare `create table` + one `grant` is not enough on
-- its own to guarantee the intended access shape.

create table if not exists public.email_log (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registrations(id) on delete cascade,
  ticket_id       uuid references public.event_tickets(id) on delete cascade,
  recipient_email text not null,
  email_type      text not null check (email_type in (
                    'athlete_confirmation',
                    'registration_organizer_notification',
                    'payment_reminder',
                    'ticket_confirmation',
                    'ticket_organizer_notification'
                  )),
  status          text not null check (status in ('sent', 'failed')),
  error_message   text,
  created_at      timestamptz not null default now(),
  check (registration_id is not null or ticket_id is not null)
);

create index if not exists email_log_registration_id_idx on public.email_log (registration_id);
create index if not exists email_log_ticket_id_idx on public.email_log (ticket_id);

alter table public.email_log enable row level security;

drop policy if exists "email_log_organizer_select" on public.email_log;
create policy "email_log_organizer_select" on public.email_log
  for select to authenticated using (public.is_organizer());

revoke all on public.email_log from anon, authenticated;
grant select on public.email_log to authenticated;
