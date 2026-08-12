-- Wodflow — migration 065: results-hidden rehearsal mode
--
-- Tjokkie (2026-08-12): wants to rehearse the full flow — heat
-- generation, scoring, everything — against the REAL Oct 2 event
-- before doors open, without athletes/spectators seeing rehearsal
-- data on the public leaderboard/heat sheet. Organizer still needs to
-- see exactly what athletes will see, to check it looks right.
--
-- Scores/heats admin pages and judge scoring are untouched — this
-- only gates the two PUBLIC pages (app/leaderboard/[divisionId],
-- app/heats/[divisionId], which the athlete portal also links
-- straight to). Defaults true so every existing/future event behaves
-- exactly as before unless an organizer deliberately flips it off.

alter table public.events
  add column if not exists results_visible boolean not null default true;
