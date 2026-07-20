-- ============================================================
-- Wodflow — migration 006: head_judge role + per-event judging mode
--
-- Tjokkie's real workflow is centralized scoring — he (the "Main
-- Judge") enters every score himself, not distributed per-lane
-- judges. head_judge is a new profiles.role; events.judging_mode
-- controls whether an event uses centralized (head_judge/organizer
-- only) or distributed (today's per-judge PIN flow) scoring. Default
-- centralized since that's the real, immediate need — distributed
-- stays available for a future organizer who wants it.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('organizer', 'judge', 'head_judge', 'athlete'));

alter table public.events
  add column if not exists judging_mode text not null default 'centralized'
    check (judging_mode in ('centralized', 'distributed'));

create or replace function public.is_head_judge()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'head_judge'
  );
$$;
