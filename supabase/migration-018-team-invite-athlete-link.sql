-- ============================================================
-- Wodflow — migration 018: team_invites links to a specific athlete row
--
-- migration-011 only stored registration_id + email_or_phone — fine
-- for finding "an" invite, but the accept flow needs to update the
-- exact registration_athletes row this invite is for, not guess by
-- matching email (fragile if two teammates share an email pattern,
-- or the invitee later signs up with a different address).
-- ============================================================

alter table public.team_invites
  add column if not exists registration_athlete_id uuid references public.registration_athletes(id) on delete cascade;
