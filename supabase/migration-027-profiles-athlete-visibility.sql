-- ============================================================
-- Wodflow — migration 027: restore organizer/head_judge visibility
-- into athlete profiles
--
-- Post-deploy audit of migration-026 found a regression: athletes are
-- deliberately NOT organization-scoped (organization_id stays null —
-- one athlete can compete across multiple boxes), but the rewritten
-- profiles_select policy only let a privileged staff member see
-- profiles within their OWN organization_id. Since athlete profiles
-- have no organization_id, that clause never matched them — silently
-- blocking every organizer-facing screen that reads full_name straight
-- off the profiles table for an athlete, e.g. the season leaderboard
-- (app/(admin)/series/[seriesId]/leaderboard/page.tsx, which needs the
-- athlete's persistent name, not whatever team name a given event
-- happened to use). Registrations/waivers/athletes-list pages were
-- unaffected — they store full_name inline on registration_athletes,
-- never joining profiles.
--
-- Fix: any privileged staff member (organizer or head_judge, for any
-- active org) can read any athlete profile — matches the pre-026
-- behavior where is_organizer() granted full profiles access with no
-- restriction, scoped back down to just the athlete role rather than
-- reopening visibility into other boxes' staff profiles.
-- ============================================================

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (
    public.is_platform_admin()
    or id = auth.uid()
    or (organization_id is not null and organization_id = public.my_organization_id())
    or (role = 'athlete' and public.my_role() in ('organizer', 'head_judge'))
  );
