# Wodflow → Rumble Series platform — design doc

**Date:** 2026-07-20
**Status:** Validated with Martin, not yet built. Precedes the 2026-07-24 call with Tjokkie.

## Context

Wodflow's single-event MVP (see `2026-07-19-wodflow-mvp-design.md`) is live and has run a real rehearsal. Tjokkie (organizer of the Rumble Series, running under Against The Grain Holdings (Pty) Ltd / "ATG") reviewed it and sent concrete feedback plus real source material: a brand kit PDF (4 sub-competition identities), two real paper scoresheets, and two real indemnity/waiver PDFs. Combined with his verbal asks (guardian/centralized scoring, athlete accounts, Rumble-series features, a 2027 season leaderboard, PayFast), this is a genuine platform expansion, not incremental tweaks. Full research and raw findings live in project memory (`project-wodflow.md`).

Real-world grounding: Competition Corner supports judge score validation and configurable tiebreakers; Wodify has an explicit "End of Judging" lock after which regular judges lose edit access — both patterns inform the design below.

## 1. Roles & multi-tenancy foundation

- `profiles.role` gains `head_judge` (Tjokkie's "Main Judge").
- `events.judging_mode` (`'centralized' | 'distributed'`), default `centralized`. Centralized = only `head_judge`/`organizer` enter scores (Tjokkie's actual model). Distributed = today's per-lane judge PIN flow, kept alive for a future box that wants it.
- Nothing new built should assume a single global organizer — every new table stays scoped by `event_id` or an organizer-owning table, in line with the schema's existing "avoid a migration if Wodflow ever runs a second organizer's event" comment.
- Athlete accounts become real (see §6) — `registration_athletes.profile_id` (already nullable "until claim") gets populated at registration time going forward instead of staying null.

## 2. Event brand kits

- New `brand_kits` table (organizer-scoped): `id`, `name`, `logo_url`, `color_primary`, `color_secondary`, `color_accent`, `tagline`. Tjokkie creates 4 once (Rumble Series, Remix, Indy, The Big One) and reuses them every year.
- `events.brand_kit_id` (nullable — no kit = Wodflow's default anti-AI look).
- Applies to: public events listing card, registration page header, indemnity page, public leaderboard, judge/scoresheet header (so exported scoresheets match the paper originals).
- Logo assets need extracting from `Corporate Branding.pdf` into Supabase Storage — not done yet, do on request.

## 3. Workout/scoresheet builder + scoring

- New `workouts` table (per `division_id`): `id`, `name`, `sequence`, `cap_seconds`, `scoring_type` (`time`|`reps`), `tiebreak_enabled`.
- New `workout_movements` table: `workout_id`, `sequence`, `name`, `reps_rx`, `reps_scaled`, `load_rx`, `load_scaled`, `rounds`. The cumulative rep-reference grid seen on paper scoresheets (`/03 /08 /12...`) is **computed on the fly** from this, never stored.
- `scores.workout_id` (currently free text) becomes a real FK to `workouts`.
- `scores` gains `rx_or_scaled` (`'rx'|'scaled'`, per-athlete choice within one division/heat — confirmed against the real scoresheet's checkbox) and `tiebreak_value` (same shape as the main score value).
- Judges/head judge still enter **one final number** per athlete (finish time, or reps/rounds reached at the cap) — matching what's actually written at the bottom of the paper sheet, not a full per-station replica.
- Centralized-mode entry screen: a **bulk-entry grid**, one heat per screen, one row per lane, RX/Scaled toggle + score input + tiebreak input inline, offline-queue-backed (reusing the existing IndexedDB offline sync — more critical now that one person enters everything). Distributed mode keeps today's per-judge PIN flow unchanged.

## 4. Locking & correction model

- `heats.status → 'completed'` is the lock event (mirrors Wodify's "End of Judging"). In distributed mode, regular judges lose insert rights via RLS the instant a heat is marked complete — enforced in Postgres, not just the UI.
- Corrections after lock: only `head_judge`/`organizer` can insert further score rows for a completed heat. Since `scores` is already append-only (multiple rows, latest-`submitted_at`-wins via `latest_scores`), a correction is just another insert — no new correction workflow needed. Add a UI confirm step ("heat is marked complete — submit correction anyway?") so it's deliberate.
- **Open question for Friday:** manual lock (Tjokkie presses a button) vs. auto-lock on `end_time` passing. Default to manual — real events run late.

## 5. Digital indemnity

- `registration_athletes` gains: `id_number` (required), `is_minor` (bool), `guardian_name`, `guardian_id_number` (required if minor).
- `events.waiver_text` gets populated with the real ATG legal text per event (photography/video release, risk acceptance, release, indemnification, POPIA consent — one consolidated block, one "I accept" action, matching how the paper form already works).
- New: `registration_athletes.waiver_text_snapshot` — the exact text agreed to at signup time, not a live link to `events.waiver_text`. Protects against later wording edits retroactively changing what an athlete appears to have agreed to — matters for the "pullable for public liability" use case.
- Per-athlete waiver PDF export from the admin, reusing the existing Chrome-headless PDF pipeline, templated per athlete.

## 6. Athlete portal + team invites

- Athletes get real accounts (email+password via Supabase auth, `role='athlete'`), profile stores `full_name`/`email`/`phone`/`id_number` once, reused on every future registration.
- Portal home: past/upcoming registrations, a "Best Finishes" panel (best placement per division type, computed across every event the athlete has entered), and a personalized "register for an event" flow off the existing public event listing.
- **Team invite flow:** new `team_invites` table (`registration_id`, `email_or_phone`, `status`, `token`). Captain starts a team registration and invites a teammate; invitee gets a link, accepts (linking their existing `profile_id`) or signs up fresh and auto-links. Payment stays **captain-pays-for-team** (matches the existing one-`price_paid`-per-registration model — no per-athlete payment splitting). Each teammate still independently completes their own indemnity (own ID number, own signature) regardless of who pays.
- **Open question for Friday:** does the team registration count as confirmed on payment alone, or only once the teammate accepts/signs the waiver too? Leaning payment-confirms-the-slot, invite/waiver completes shortly after — flag, don't guess.

## 7. Admin control center

- Expanded nav (today's is just Events/Judges): **Events · Divisions · Brand Kits · Judges/Staff · Athletes · Reports · Settings.**
- Dashboard home: event health rollup (draft/published/live status, outstanding pre-event-checklist items, payment reconciliation summary) instead of clicking into each event individually.
- **Athletes** (new, cross-event): searchable directory of every athlete who's registered for any event, with registration/indemnity/payment status per event — where "did everyone sign a waiver" gets checked before an event.
- **Reports:** CSV export of registrations (check-in sheets), bulk indemnity PDF export (zipped, per event), payment reconciliation CSV.
- **Settings:** `judging_mode` toggle, brand kit assignment, eventually payment provider choice (Yoco vs PayFast).
- No new data model here — pure UI/aggregation over tables already covered above.

## 8. Leaderboards — live event vs. season/BIG

- **Configurable scoring formula:** `divisions.scoring_config jsonb`, e.g. `{"method": "gap_formula", "winner_points": 100}` (Tjokkie's proposed 100-minus-gap model) or `{"method": "rank_sum"}` (today's entrants−position+1). Leaderboard computation reads this instead of hardcoding one formula. Tiebreaks resolve via `tiebreak_value` (§3) wherever two athletes land on the same primary score.
- **Live event leaderboard:** existing `public_leaderboard` view (Milestone 6), updated for the new `workouts`/`scores` shape and pluggable formula — otherwise unchanged.
- **Season/BIG leaderboard (2027 Rumble Series) — separate concept, needs athlete accounts as a hard prerequisite:**
  - `series` table (organizer-scoped: `name`, `year`).
  - `series_events` links specific `events` into a `series`, in order.
  - `series_points_config` — same pluggable-formula idea, applied to an athlete's **overall placement per event**, not per-workout.
  - Points accumulate per `profile_id` (must persist across events — why §6 is a prerequisite, not optional), summed via a view mirroring the single-event leaderboard pattern.
  - Not urgent to build before the season actually starts, but the athlete-identity data model has to exist now or points can't be tracked correctly once 2027 begins.

## Decisions confirmed with Martin (2026-07-20)

1. Judge permissions: **centralized (head_judge-only) entry**, configurable per event — distributed mode kept for future resale.
2. Score granularity: **one final number** per athlete, not a per-station/round breakdown.
3. RX/Scaled: **per-athlete choice within one division**, not separate divisions.
4. Brand kits: **generic, organizer-configurable** field/table, not hardcoded to the 4 known Rumble kits.
5. Indemnity: add **both** ID number and minor/guardian fields now.
6. Phase scope: build **the full vision** in one continuous effort — brand kits, scoresheet builder, indemnity, athlete portal + teams, admin control center, live + season leaderboards — rather than deferring to a smaller Friday-scoped slice.

## Open questions to raise with Tjokkie on 2026-07-24

- Manual vs. auto heat-lock on `end_time`.
- Does team registration confirm on payment alone, or does it need the teammate's accept/waiver too?
- Confirm the exact points-formula rounding behavior (his 100/12=8 example doesn't cleanly reach 0 at 12th place — needs his intent, not an assumption).
- Confirm PayFast is meant to replace Yoco for his events, or run alongside it.
