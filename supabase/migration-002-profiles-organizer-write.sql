-- ============================================================
-- Wodflow — migration 002: organizer can write any profile
--
-- rls-policies.sql gave organizer full SELECT on profiles but only a
-- self-update policy — there was no path for the organizer to set
-- someone else's role (e.g. promoting a signed-up athlete to judge)
-- via a plain RLS-scoped update. set_user_pin already handles PIN
-- setting itself (SECURITY DEFINER), but role/full_name changes need
-- this policy.
-- ============================================================

drop policy if exists "profiles_organizer_write" on public.profiles;
create policy "profiles_organizer_write" on public.profiles
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());
