-- Athletes/organizers had no self-service way to recover a forgotten
-- password (Mariskha van Aswegen support case, 2026-09-13) — athlete-login
-- and organizer /login both only ever offered sign-in, no reset path.
-- Supabase's built-in resetPasswordForEmail can't be used here: no SMTP is
-- configured on this project (see app/api/org-invites/[token]/accept/
-- route.ts's comment), so its emails would silently never arrive. Instead
-- this mints our own short-lived token and sends the email through the
-- same Cloudflare EMAIL binding already used for registration/ticket mail.
create table if not exists public.password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  token       uuid not null default gen_random_uuid(),
  expires_at  timestamptz not null default (now() + interval '1 hour'),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create unique index if not exists password_reset_tokens_token_idx
  on public.password_reset_tokens (token);

create index if not exists password_reset_tokens_profile_id_idx
  on public.password_reset_tokens (profile_id);

-- RLS enabled with zero policies, same as org_invites: only the
-- service-role API routes below ever touch this table directly.
alter table public.password_reset_tokens enable row level security;
