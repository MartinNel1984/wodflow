-- Wodflow — migration 068: event duplication for isolated rehearsal
--
-- Tjokkie (2026-08-13): worried that rehearsing heat assignment,
-- scoring, tie-breaks and points against the REAL Oct 2 event (even
-- with migration-065's results-hidden toggle) still means mucking
-- with real registration/heat/score rows. He asked for something
-- "almost like a second event ... I can muck around there" instead.
--
-- This adds the two columns a "Duplicate for testing" action needs:
-- is_test flags the clone so it can be told apart from a real event
-- at a glance (dashboard badge, future bulk-cleanup query), and
-- cloned_from_event_id traces it back to the source. The clone itself
-- reuses migration-065's results_visible flag (defaulted false) so it
-- never appears on the public leaderboard/heat sheet — no new gating
-- logic needed.
alter table public.events
  add column if not exists is_test boolean not null default false,
  add column if not exists cloned_from_event_id uuid references public.events(id) on delete set null;
