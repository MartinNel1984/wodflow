-- Wodflow — migration 077: judge application "competing at Big One?" flag
--
-- Tjokkie, 2026-09-01: on the judge signup form, wants to know upfront
-- whether an applicant is also competing at Rumble "The Big One" (a
-- judge who's also an athlete needs different heat/roster planning).

alter table public.judge_applications
  add column if not exists competing_in_big_one boolean not null default false;
