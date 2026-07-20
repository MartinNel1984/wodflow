-- ============================================================
-- Wodflow — migration 015: fix judge score-insert visibility bug
--
-- Found via real functional RLS testing (verify-m9-rls.mts), same
-- class of bug as migration-003's ON CONFLICT finding: the
-- distributed-mode judge insert policy joined directly to `events`
-- to read judging_mode, but that join runs under the JUDGE's own
-- RLS — and events_select_public only allows non-organizers to see
-- published/live/archived events, not draft. Result: a judge
-- assigned to a heat on a still-draft event would be silently
-- blocked from submitting any score at all, with no useful error.
--
-- Fix: read judging_mode through a SECURITY DEFINER helper (same
-- pattern as is_judge()/my_assigned_heat_ids()) so the lookup bypasses
-- events RLS, matching how heats/divisions are already unconditionally
-- readable regardless of the parent event's publish status.
-- ============================================================

create or replace function public.heat_judging_mode(p_heat_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select e.judging_mode
  from public.heats h
  join public.divisions d on d.id = h.division_id
  join public.events e on e.id = d.event_id
  where h.id = p_heat_id;
$$;

drop policy if exists "scores_insert_judge" on public.scores;
create policy "scores_insert_judge" on public.scores
  for insert to authenticated with check (
    public.is_judge()
    and heat_assignment_id in (
      select ha.id
      from public.heat_assignments ha
      join public.heats h on h.id = ha.heat_id
      where ha.heat_id in (select public.my_assigned_heat_ids())
        and h.status <> 'completed'
        and public.heat_judging_mode(h.id) = 'distributed'
    )
  );
