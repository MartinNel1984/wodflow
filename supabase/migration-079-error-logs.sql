-- Wodflow — migration 079: error_logs
--
-- Lightweight self-hosted error tracking (Martin, 2026-09-07): runtime
-- errors (client-side crashes, server action/API route failures) get
-- persisted here instead of just console.error'd, and a GitHub Actions
-- job (error-alert-check.yml) polls this table and WhatsApps Martin
-- via CallMeBot when a NEW (or newly-recurring) error shows up. Same
-- "unique-constraint-catch" dedupe shape as email_log, but keyed by a
-- fingerprint instead of a natural id — the same error on the same
-- route bumps a counter instead of creating a new row.
--
-- Explicit `revoke all ... then grant select only` per the lesson in
-- migration-066/067 — Supabase's default-privilege scaffold grants ALL
-- to anon/authenticated on new objects, so a bare `create table` is
-- not enough on its own to guarantee the intended access shape.

create table if not exists public.error_logs (
  id                uuid primary key default gen_random_uuid(),
  fingerprint       text not null,              -- sha256(message + route), 16 hex chars
  message           text not null,
  stack             text,
  route             text,
  source            text not null check (source in (
                      'client', 'server_action', 'api_route', 'server_component'
                    )),
  severity          text not null default 'error' check (severity in ('error', 'warning')),
  context           jsonb,
  occurrence_count  integer not null default 1,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  alert_sent        boolean not null default false,
  resolved          boolean not null default false,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- Only one OPEN (unresolved) row per fingerprint — a resolved error
-- that recurs later opens a fresh row rather than being silently
-- folded back into the old, already-dealt-with one.
create unique index if not exists error_logs_fingerprint_open_idx
  on public.error_logs (fingerprint) where resolved = false;

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);
create index if not exists error_logs_alert_sent_idx on public.error_logs (alert_sent) where alert_sent = false;

-- Atomic bump for the "already have an open row for this fingerprint"
-- path — lib/log-error.ts calls this via rpc() on a 23505 unique-
-- violation from the insert above. Resetting alert_sent lets a
-- recurring error re-alert after a quiet period without spamming on
-- every occurrence within a single burst (error-alert-check.yml only
-- runs every 15 minutes regardless).
create or replace function public.bump_error_log(p_fingerprint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.error_logs
  set occurrence_count = occurrence_count + 1,
      last_seen_at = now(),
      alert_sent = false
  where fingerprint = p_fingerprint and resolved = false;
end;
$$;

alter table public.error_logs enable row level security;

drop policy if exists "error_logs_organizer_select" on public.error_logs;
create policy "error_logs_organizer_select" on public.error_logs
  for select to authenticated using (public.is_organizer());

revoke all on public.error_logs from anon, authenticated;
grant select on public.error_logs to authenticated;
