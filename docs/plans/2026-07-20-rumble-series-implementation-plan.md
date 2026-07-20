# Rumble Series platform — implementation plan

**Date:** 2026-07-20
**Design doc:** `docs/plans/2026-07-20-rumble-series-platform-design.md` (read that first — this plan just sequences it into buildable, testable milestones)
**Standard to hold throughout:** every milestone gets a REAL functional test before being called done — real sign-in, real RLS denial, real submission through the actual UI — not "the code compiles." This is the standard the original 8-milestone MVP was held to; no reason to lower it now.

Numbering continues from the MVP's Milestones 0–8.

## Milestone 9 — Schema foundation (no UI yet)

Everything downstream depends on this landing cleanly and being RLS-correct from the start (the MVP found real RLS bugs at nearly every schema-touching milestone — expect the same discipline here).

- `profiles.role` gains `head_judge`.
- `events.judging_mode` (`centralized`|`distributed`, default `centralized`), `events.brand_kit_id`.
- `brand_kits` table (organizer-scoped).
- `workouts`, `workout_movements` tables; `scores.workout_id` migrated from free text to FK; `scores` gains `rx_or_scaled`, `tiebreak_value`.
- `registration_athletes` gains `id_number`, `is_minor`, `guardian_name`, `guardian_id_number`, `waiver_text_snapshot`.
- `team_invites` table.
- `divisions.scoring_config jsonb`.
- `series`, `series_events`, `series_points_config` tables (schema only — no UI until Milestone 17).
- RLS: head_judge/organizer unrestricted score inserts; distributed-mode judges blocked once `heats.status = 'completed'`.

**Test:** real sign-in as each role (organizer, head_judge, judge, athlete) verifying RLS allows/denies exactly as designed — same standard as the original M1 verification. No feature UI needed yet, just prove the foundation is sound before building on it.

## Milestone 10 — Brand kits

Admin CRUD for brand kits (name, logo upload, 3 colors, tagline); assign a kit to an event; kit's logo/colors render on the public event card, registration page, indemnity page, leaderboard, and scoresheet header.

**Test:** create Tjokkie's 4 real kits via the UI, assign one to a real event, verify the color/logo actually renders across all 5 surfaces above in a real browser session, not just "the field saved."

## Milestone 11 — Workout/scoresheet builder

Admin UI to build a division's workouts: add workout (name, cap, scoring type), add movements per workout (name, reps RX/Scaled, rounds). Cumulative reference grid renders computed from movement data, matching the paper scoresheet layout.

**Test:** rebuild the real "Love 8 Relationship" workout (8 rounds × 3 movements) through the UI, confirm the generated cumulative grid matches the real paper sheet's numbers exactly (`/03 /08 /12 /16...`).

## Milestone 12 — Centralized scoring + locking

Head-judge bulk-entry grid (one heat per screen, one row per lane: RX/Scaled toggle, score input, tiebreak input), offline-queue-backed. Heat lock button (manual, per §4 of the design doc) + correction-after-lock confirm flow for head_judge/organizer.

**Test:** re-run the same offline-drop rehearsal the original M5 used (real browser, simulated dropped connection, reload survival, reconnect-and-resync) but against the new bulk-entry grid. Separately verify: heat locks, a regular judge's insert is genuinely rejected by RLS post-lock (distributed mode), head_judge correction still succeeds with the confirm step.

## Milestone 13 — Digital indemnity

Registration form gains ID number + minor/guardian fields (conditional on minor checkbox). Real ATG waiver text per event, snapshotted into `waiver_text_snapshot` at signup. Per-athlete waiver PDF export from admin.

**Test:** real registration through the UI as both an adult and a minor path, confirm snapshot text is captured (not just a live link), generate a real PDF export and check it renders the actual agreed text + signature + ID.

## Milestone 14 — Athlete accounts + portal

Athlete signup/login, profile fields reused across registrations, portal home (past/upcoming registrations, Best Finishes), register-for-event from the portal.

**Test:** real athlete signup, real registration through the portal (not the old anonymous wizard), confirm profile fields pre-fill on a second registration, confirm Best Finishes reflects real seeded results.

## Milestone 15 — Team invites

`team_invites` wiring: captain invites teammate, invite link → accept (existing account) or signup-then-link (new account), captain-pays-for-team confirmed, each teammate completes their own indemnity independently.

**Test:** real two-account rehearsal — captain registers a team, invites a real second test account, confirm linking works both for an existing account and a fresh signup, confirm payment gate and independent waiver completion.

## Milestone 16 — Admin control center

Expanded nav (Events/Divisions/Brand Kits/Judges/Athletes/Reports/Settings), dashboard health rollup, cross-event athlete directory, CSV/PDF exports (registrations, zipped indemnity PDFs, payment reconciliation), judging_mode + brand kit settings.

**Test:** real walk-through as organizer covering every nav item, confirm each export produces a real, correctly-scoped file (not empty or wrong-event data).

## Milestone 17 — Configurable leaderboard scoring

`scoring_config`-driven formula engine (gap formula + existing rank-sum as the two initial options), tiebreak resolution wired into the live leaderboard.

**Test:** re-verify ranking math against raw seeded DB data for both formulas, plus a deliberately tied pair of scores to confirm tiebreak resolves correctly.

## Milestone 18 — Season/BIG leaderboard (lower priority — no real urgency until the season starts)

Minimal admin UI: create a series, assign events to it, view the summed season leaderboard.

**Test:** seed 2 fake events into a test series with known results, confirm the summed leaderboard math is correct.

## Sequencing notes

- 9 is a hard prerequisite for everything else.
- 10–13 can proceed in roughly any order once 9 lands (they touch mostly-disjoint parts of the schema).
- 12 (centralized scoring) is the highest-value milestone for Tjokkie's actual next event — worth prioritizing right after 9 if time is tight before an event date.
- 14 is a prerequisite for 15 and 18. 17 has no hard prerequisite beyond 9 and could be pulled forward if the current leaderboard formula becomes a blocker sooner.
- 18 has no real deadline pressure (2027 season) — fine to land last.
