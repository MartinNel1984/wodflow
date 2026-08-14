-- ============================================================
-- Wodflow — migration 071: split PB rankings by gender
--
-- Martin/Tjokkie flagged that combining male and female athletes in
-- one PB ranking (migration-070) isn't fair — a men's 160kg deadlift
-- and a women's 160kg deadlift shouldn't compete for the same rank
-- slot. profiles has no gender field today (gender only exists on
-- divisions/historical_results, tied to event registrations — a PB
-- entry isn't tied to either), so this adds a self-reported gender
-- field on profiles, same pattern as gym_name (migration-060), and
-- reworks get_my_pb_rankings() to rank within the athlete's own
-- gender group.
--
-- Athletes with no gender set yet are excluded from ranking (both as
-- a ranked candidate and from other athletes' totals) until they set
-- it — same "fill in your profile to unlock this" precedent as
-- gym_name/is_atg_athlete already.
--
-- Run in the Supabase SQL Editor in one go. Safe to re-run.
-- ============================================================

alter table public.profiles
  add column if not exists gender text check (gender in ('male', 'female'));

-- Extend the migration-035/060 self-update column grant to include
-- gender.
revoke update on public.profiles from authenticated;
grant update (full_name, email, phone, id_number, gym_name, gender, updated_at)
  on public.profiles to authenticated;

-- ------------------------------------------------------------
-- get_my_pb_rankings() — now partitions each lift's ranking by
-- gender instead of pooling every ATG athlete together. Athletes
-- with gender is null are dropped from the candidate pool entirely
-- (pr.gender is not null filter), so a caller without gender set
-- gets no rows back for any lift — the app shows a "set your gender"
-- prompt in that case (same shape as "no PB logged yet").
-- ------------------------------------------------------------
create or replace function public.get_my_pb_rankings()
returns table (lift_key text, my_best_value numeric, my_best_date date, athlete_rank bigint, total_athletes bigint)
language sql stable security definer set search_path = public as $$
  with atg_bests as (
    select
      p.lift_key,
      p.profile_id,
      p.gender,
      p.value_numeric,
      p.achieved_date,
      case when p.lift_key in ('isabel', 'grace', 'fran') then p.value_numeric else -p.value_numeric end as sort_value
    from (
      select distinct on (ap.profile_id, ap.lift_key)
        ap.profile_id, ap.lift_key, ap.value_numeric, ap.achieved_date, pr.gender
      from public.athlete_pbs ap
      join public.profiles pr on pr.id = ap.profile_id
      where (pr.gym_name ilike '%atg%' or pr.gym_name ilike '%against the grain%')
        and pr.gender is not null
      order by ap.profile_id, ap.lift_key,
        case when ap.lift_key in ('isabel', 'grace', 'fran') then ap.value_numeric else -ap.value_numeric end asc
    ) p
  ),
  ranked as (
    select
      lift_key,
      profile_id,
      value_numeric,
      achieved_date,
      rank() over (partition by lift_key, gender order by sort_value asc) as athlete_rank,
      count(*) over (partition by lift_key, gender) as total_athletes
    from atg_bests
  )
  select lift_key, value_numeric, achieved_date, athlete_rank, total_athletes
  from ranked
  where profile_id = auth.uid();
$$;

grant execute on function public.get_my_pb_rankings() to authenticated;
