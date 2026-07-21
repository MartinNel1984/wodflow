-- ============================================================
-- Wodflow — migration 020: per-IP signup throttle
--
-- The app runs on Cloudflare Workers (serverless, no shared in-memory
-- state), so a rate limit needs a backing store. This tiny table logs
-- athlete-signup attempts per IP; the signup route counts recent rows
-- in a short window and rejects once over the limit. Only the service
-- role (which bypasses RLS) ever touches it — RLS is enabled with no
-- policies so anon/authenticated can neither read nor write it.
-- ============================================================

create table if not exists public.signup_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip         text,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_ip_time
  on public.signup_attempts (ip, created_at);

alter table public.signup_attempts enable row level security;
