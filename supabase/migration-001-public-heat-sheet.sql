-- ============================================================
-- Wodflow — migration 001: public heat sheet view
--
-- The public heat sheet needs to show team/athlete DISPLAY NAMES
-- without exposing the PII-containing registrations/
-- registration_athletes tables to anon. rls-policies.sql correctly
-- blocks anon from those tables entirely, which means a plain nested
-- select (heats -> heat_assignments -> registrations) returns null
-- for the registrations relation when queried as anon — RLS applies
-- per-table regardless of join path.
--
-- Fix: a narrow view that deliberately runs as the view owner
-- (security_invoker = false, the opposite of the latest_scores fix in
-- schema.sql) so it CAN read registrations/registration_athletes, but
-- only ever selects team_name / the captain's full_name — never
-- email, phone, payment status, or waiver fields.
-- ============================================================

create or replace view public.public_heat_sheet
with (security_invoker = false) as
select
  h.id as heat_id,
  h.division_id,
  h.heat_number,
  h.start_time,
  ha.lane_number,
  coalesce(
    r.team_name,
    (
      select ra.full_name
      from public.registration_athletes ra
      where ra.registration_id = r.id and ra.is_captain
      limit 1
    )
  ) as display_name
from public.heats h
join public.heat_assignments ha on ha.heat_id = h.id
join public.registrations r on r.id = ha.registration_id;

grant select on public.public_heat_sheet to anon, authenticated;
