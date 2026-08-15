-- Wodflow — migration 075: organizer-side ATG PB Board
--
-- Tjokkie: cool to have a PB Board on the organizer side, filterable
-- by Male/Female and by lift — useful to call out at a live comp
-- ("Piete's listed Clean & Jerk is 120kg's, going for a new PB").
--
-- athlete_pbs' own RLS only lets an athlete read their own rows
-- (migration-070) — same problem get_my_pb_rankings() solved for the
-- athlete-facing rank number, solved here the same way (security
-- definer) but returning every ATG athlete's current best per lift,
-- gated to organizers only. Same single-tenant scoping as the rest of
-- the PB feature (gym_name free-text match, not organization_id) —
-- this is still ATG's own feature, not platform-wide.
create or replace function public.get_atg_pb_board()
returns table (
  profile_id uuid,
  full_name text,
  gender text,
  lift_key text,
  value_numeric numeric,
  achieved_date date
)
language sql stable security definer set search_path = public as $$
  select distinct on (ap.profile_id, ap.lift_key)
    ap.profile_id,
    pr.full_name,
    pr.gender,
    ap.lift_key,
    ap.value_numeric,
    ap.achieved_date
  from public.athlete_pbs ap
  join public.profiles pr on pr.id = ap.profile_id
  where (pr.gym_name ilike '%atg%' or pr.gym_name ilike '%against the grain%')
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'organizer')
  order by ap.profile_id, ap.lift_key,
    case when ap.lift_key in ('isabel', 'grace', 'fran') then ap.value_numeric else -ap.value_numeric end asc;
$$;

grant execute on function public.get_atg_pb_board() to authenticated;
