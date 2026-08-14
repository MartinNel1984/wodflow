-- ============================================================
-- Wodflow — migration 070: athlete 1RM / benchmark PB tracker
--
-- ATG asked for a way to motivate athletes and drive portal traffic:
-- a personal-best tracker on the athlete portal for 4 barbell 1RMs
-- (Clean & Jerk, Snatch, Back Squat, Deadlift), 3 CrossFit benchmark
-- workouts scored as fastest time (Isabel, Grace, Fran), and Max Pull
-- Ups (reps). Athletes log their own PBs with a date; the portal shows
-- how they rank against other ATG athletes who've logged that same
-- lift ("24 / 130 athletes").
--
-- Scoped to ATG only (gym_name free-text match) — this is a
-- single-box feature for now, not a platform-wide one. gym_name is a
-- free-text field athletes typed themselves (no dropdown), hence the
-- fuzzy ilike match rather than an exact string compare.
--
-- Design doc: docs/plans/2026-08-14-athlete-pb-tracker-design.md
--
-- Run this whole file in the Supabase SQL Editor in one go. Safe to
-- re-run (create-if-not-exists / drop-if-exists throughout).
-- ============================================================

-- ------------------------------------------------------------
-- 1. athlete_pbs — one row per logged PB attempt (full history,
--    not just the current best, so progression can be shown).
--    value_numeric is unit-agnostic: kg for the 4 barbell lifts,
--    reps for Max Pull Ups, seconds for Isabel/Grace/Fran (stored as
--    seconds rather than a time string so ranking is a plain numeric
--    sort — the app layer formats it back to mm:ss for display).
-- ------------------------------------------------------------
create table if not exists public.athlete_pbs (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  lift_key       text not null check (lift_key in (
                    'clean_jerk', 'snatch', 'back_squat', 'deadlift',
                    'isabel', 'grace', 'fran', 'max_pull_ups'
                  )),
  value_numeric  numeric not null check (value_numeric > 0),
  achieved_date  date not null,
  created_at     timestamptz not null default now()
);

create index if not exists athlete_pbs_profile_lift_idx
  on public.athlete_pbs (profile_id, lift_key);

alter table public.athlete_pbs enable row level security;

-- Athletes manage only their own rows — no admin/organizer UI for
-- this table yet, so no privileged-write policy is needed.
drop policy if exists "athlete_pbs_select_own" on public.athlete_pbs;
drop policy if exists "athlete_pbs_write_own" on public.athlete_pbs;
create policy "athlete_pbs_select_own" on public.athlete_pbs
  for select to authenticated using (profile_id = auth.uid());
create policy "athlete_pbs_write_own" on public.athlete_pbs
  for all to authenticated using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select, insert, update, delete on public.athlete_pbs to authenticated;

-- ------------------------------------------------------------
-- 2. is_atg_athlete() — fuzzy match on the free-text gym_name field
--    athletes fill in on their profile. Used both to gate the /pbs
--    route and to scope the ranking function below to ATG only.
-- ------------------------------------------------------------
create or replace function public.is_atg_athlete()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        gym_name ilike '%atg%'
        or gym_name ilike '%against the grain%'
      )
  );
$$;

-- ------------------------------------------------------------
-- 3. get_my_pb_rankings() — returns the CALLER's own rank + total
--    for each lift they've logged, among other ATG athletes who've
--    logged that same lift. security definer so it can read across
--    every ATG athlete's best value to compute the rank, without
--    ever widening athlete_pbs' RLS to let athletes read each
--    other's rows directly (that would leak full PB history, not
--    just a rank number).
--
--    Ranking direction differs by lift: the 4 barbell lifts and Max
--    Pull Ups are highest-value-wins, Isabel/Grace/Fran (stored in
--    seconds) are lowest-value-wins. sort_value normalizes both
--    directions to "ascending = best" so a single rank() call works
--    for every lift.
-- ------------------------------------------------------------
create or replace function public.get_my_pb_rankings()
returns table (lift_key text, my_best_value numeric, my_best_date date, athlete_rank bigint, total_athletes bigint)
language sql stable security definer set search_path = public as $$
  with atg_bests as (
    -- Each ATG athlete's single best entry per lift.
    select
      p.lift_key,
      p.profile_id,
      p.value_numeric,
      p.achieved_date,
      case when p.lift_key in ('isabel', 'grace', 'fran') then p.value_numeric else -p.value_numeric end as sort_value
    from (
      select distinct on (profile_id, lift_key)
        profile_id, lift_key, value_numeric, achieved_date
      from public.athlete_pbs ap
      join public.profiles pr on pr.id = ap.profile_id
      where pr.gym_name ilike '%atg%' or pr.gym_name ilike '%against the grain%'
      order by profile_id, lift_key,
        case when ap.lift_key in ('isabel', 'grace', 'fran') then ap.value_numeric else -ap.value_numeric end asc
    ) p
  ),
  ranked as (
    select
      lift_key,
      profile_id,
      value_numeric,
      achieved_date,
      rank() over (partition by lift_key order by sort_value asc) as athlete_rank,
      count(*) over (partition by lift_key) as total_athletes
    from atg_bests
  )
  select lift_key, value_numeric, achieved_date, athlete_rank, total_athletes
  from ranked
  where profile_id = auth.uid();
$$;

grant execute on function public.is_atg_athlete() to authenticated;
grant execute on function public.get_my_pb_rankings() to authenticated;
