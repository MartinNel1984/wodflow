-- Community Cup drill-down (Tjokkie, 2026-10-05): expanding a gym row
-- on the public/admin leaderboard now shows per-event attribution with
-- the actual teammate names from that gym on each placed team. The
-- existing public_registration_gyms view (migration-091) only carried
-- registration_id, profile_id and gym_name — add full_name so the
-- Community Cup compute step can render contributions without a second
-- query (and without needing registration_athletes read access, which
-- is RLS-closed for anon).

create or replace view public.public_registration_gyms
with (security_invoker = false) as
select
  ra.registration_id,
  ra.profile_id,
  ra.full_name,
  ra.gym_name
from public.registration_athletes ra
where ra.gym_name is not null;

revoke all on public.public_registration_gyms from anon, authenticated;
grant select on public.public_registration_gyms to anon, authenticated;
