-- Wodflow — migration 091: Community Cup foundations
--
-- Phase 2 of the 2027 Rumble Series work (Tjokkie): a per-series gym
-- leaderboard where each team's finish points at each event are
-- distributed proportionally across the gyms its athletes belong to.
-- 100% pure-gym team → 100% to that gym; mixed 50/50 team → 50 each.
-- A gym appears on the public page once it has ≥ 5 distinct athletes
-- entered in the series (but points accrue from event 1 regardless).
--
-- This migration adds the two series-level config knobs and the
-- anon-safe view we need to join registrations → gym rolls without
-- opening registration_athletes to anon (that stays authenticated-only
-- because it carries emails and other PII).

-- --- Series config -----------------------------------------------------

alter table public.series
  add column if not exists community_cup_enabled boolean not null default false,
  add column if not exists community_cup_min_athletes int not null default 5
    check (community_cup_min_athletes > 0);

-- --- Anon-safe view of registration gym rolls --------------------------
--
-- Only columns needed for the Community Cup compute:
--   registration_id  — join key to series finishes
--   profile_id       — needed to count DISTINCT athletes per gym
--                      (null for unclaimed teammate rows; those just
--                      don't count toward the min-athletes threshold)
--   gym_name         — the snapshot text written at registration time
--                      (the admin /gyms rename-cascade keeps this in
--                      sync with the master list in public.gyms)
--
-- No PII (email, phone, name) is exposed. profile_id is a bare UUID
-- that resolves to nothing without separate access to profiles.

create or replace view public.public_registration_gyms
with (security_invoker = false) as
select
  ra.registration_id,
  ra.profile_id,
  ra.gym_name
from public.registration_athletes ra
where ra.gym_name is not null;

-- Both halves of the revoke+grant pair per the migration-076 lesson —
-- create or replace resets scaffold privileges to the default-anon-ALL
-- grant unless we explicitly re-close it.
revoke all on public.public_registration_gyms from anon, authenticated;
grant select on public.public_registration_gyms to anon, authenticated;
