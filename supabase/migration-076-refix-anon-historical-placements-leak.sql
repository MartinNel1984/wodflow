-- Wodflow — migration 076: re-close the public_historical_placements anon leak
--
-- Regression of the leak fixed in migration-066. Root cause: migration-073
-- (2026-08-20, adding season_year filtering support) had to `drop view` +
-- `create view` on public_historical_placements to append a column ahead
-- of existing ones (CREATE OR REPLACE VIEW can only append at the end).
-- Dropping and recreating the view resets it to Supabase's default-privilege
-- scaffold, which grants ALL privileges to anon and authenticated again —
-- exactly the mechanism migration-066 documented and fixed. Migration-073
-- only re-ran `grant select ... to authenticated`, not the `revoke all`
-- half, so the anon grant silently came back.
--
-- Confirmed live via health check, 2026-08-31: unauthenticated curl against
-- the REST API returned all 449 rows including real athlete_email addresses
-- again, identical to the original 08-13 finding.
--
-- Lesson: any future migration that drops+recreates this view (or any other
-- view with a narrowed grant) MUST re-run both halves of this revoke/grant
-- pair, not just the grant. Consider this a standing checklist item, not a
-- one-time fix.

revoke all on public.public_historical_placements from anon, authenticated;
grant select on public.public_historical_placements to authenticated;
