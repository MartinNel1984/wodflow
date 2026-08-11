-- ============================================================
-- Wodflow — migration 060: add gym name field
--
-- Tjokkie asked for a "Gym Name" field on sign-up and on the athlete's
-- personal profile, so leaderboards/results can eventually show which
-- box an athlete trains at. Optional on both tables — existing athletes
-- (registered before this migration) will simply have it blank until
-- they fill it in via their profile.
--
-- Run in the Supabase SQL Editor in one go. Safe to re-run.
-- ============================================================

alter table public.profiles
  add column if not exists gym_name text;

alter table public.registration_athletes
  add column if not exists gym_name text;

-- Extend the migration-035 self-update column grant to include gym_name.
revoke update on public.profiles from authenticated;
grant update (full_name, email, phone, id_number, gym_name, updated_at)
  on public.profiles to authenticated;
