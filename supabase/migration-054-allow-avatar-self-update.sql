-- Wodflow — migration 054: allow athletes to set their own avatar_url
--
-- migration-035 locked self-service profile updates to a specific
-- column allowlist (full_name, email, phone, id_number, updated_at) —
-- a deliberate privilege-escalation fix, not an oversight. avatar_url
-- (migration-053) was added after that allowlist and needs to be added
-- to it explicitly, or every athlete's own avatar upload fails with
-- "permission denied for table profiles" (confirmed live via a
-- throwaway synthetic-athlete test) despite the RLS row policy and
-- storage policy both being correct — this is a separate Postgres
-- column-level GRANT, not something RLS controls.

grant update (avatar_url) on public.profiles to authenticated;
