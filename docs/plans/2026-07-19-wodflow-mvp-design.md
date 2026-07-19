# Wodflow — MVP Design

## Background

Martin competed in a CrossFit event running on scoreit.co.za (see memory `reference-scoreit-assessment`) and watched the platform break mid-competition, after the first round. The organizer — who now trusts Martin directly from the competitor side, not as a cold pitch — asked whether DraftTwo Studio could build something more reliable. Martin committed on the spot. This is a single-client build first (this organizer's events), architected so a resale path exists later without a rewrite, but that's not the near-term goal.

The organizer's three explicit complaints: **reliability**, **easier score entry**, **easier heat generation**. Everything in this design is scoped around fixing those three things extremely well, plus the minimum needed to get athletes registered, consenting, and paid.

Target: usable for a real event within ~1–2 months.

## Roles

- **Organizer (admin)** — creates event, divisions, pricing, waiver text, generates heats, monitors live scoring, publishes leaderboard.
- **Athlete/team** — registers, picks division, acknowledges waiver, pays entry fee, views heat time/lane and live standings.
- **Judge/scorekeeper** — scoped to one or more stations/heats on event day; enters scores against the athlete/team assigned to that heat.
- **Spectator (public, no login)** — views public leaderboard, heat sheet, event info.

## Architecture

Same stack as tcrpv Portal / DraftTwo Portal / Robotics League Portal: Next.js frontend, Supabase (Postgres + RLS + Auth), Cloudflare hosting. No new infra risk — the CORS/CSP gotchas and migration workflow are already known quantities, which matters given reliability is the whole reason this contract exists.

Everything scopes to a single `event_id` — divisions, heats, registrations, scores all belong to one event record. Costs nothing extra now, and is what makes "run this for another organizer later" possible without a rewrite.

## Core flows

### Registration, waiver & payment
- Organizer defines divisions, pricing (early-bird/normal/late tiers supported), waiver text.
- Athlete: pick division → add teammates (name/email each — everyone gets their own login, not just the captain) → digital waiver acknowledgment (typed full name + checkbox + timestamp, stored against the registration record — legally-sufficient, low-friction on mobile) → pay via Yoco (reuse the exact integration already built and proven for NudgePay's "Pay now") → confirmation email/WhatsApp.

### Heat auto-generation
- Organizer input per division: lane/station count, heat duration, transition time, start time.
- System seeds heats in reverse-ranked order where a prior score exists, otherwise registration order; fills lanes top-down; schedules back-to-back heat times.
- Organizer can drag-and-drop to fix an individual placement (injury swap, no-show) without regenerating the whole division — regeneration is whole-division, manual edits are surgical.
- Output: a published, public heat sheet, no login required.

### Score entry (the critical path)
- Judge logs into a lightweight mobile view scoped to *their assigned heat/station only* — one screen: athlete/team name, the single input the workout needs (time/reps/load), big submit button.
- **Offline-first**: score writes to local state and shows "saved" instantly, syncs to Supabase in the background with retry-on-reconnect. This directly targets the actual failure mode — a network/backend hiccup taking down score entry mid-event.
- Organizer gets a live "which heats have outstanding scores" dashboard to catch a missed submission before leaderboard time.

## Reliability architecture

- Offline-first score entry (above) is the primary defense — the real failure mode to design against is *client-side* (bad wifi at a venue), not backend load.
- Supabase's built-in Postgres reliability + connection pooling is more than sufficient at this scale; no need for read replicas or anything exotic.
- **Pre-event dry run** built into the product: organizer can run a "test heat" the day before to catch config mistakes (empty divisions, missing lane counts) — this directly targets the empty/unconfigured-event failure mode found in the ScoreIT review (an event 5 days out with no address, contact, or registration date populated).

## Visual direction

High-energy, modern — explicitly not another dark-theme-plus-stock-gym-photo template. Apply the studio's anti-AI design rules (see memory `reference-anti-ai-design-rules`): fluid type, an editorial-weight display face for event names paired with a sharp geometric sans for interface text, one strong accent color pulled from the sport's energy rather than a generic gym-red, purposeful motion (live leaderboard rows animate on rank change, heat-countdown timers with real presence). This is also the studio's shop window for future organizer clients, so it should look like nothing else in this space.

## MVP phasing

**Phase 1 (MVP — the pitch, must be rock-solid for the next event):**
- Organizer: create event, divisions, pricing, waiver text
- Athlete: register, pick division/team, sign waiver, pay via Yoco, get confirmation
- Organizer: heat auto-generation with manual lane override
- Judge: mobile score entry scoped to assigned heat, offline-first with sync
- Public: live leaderboard, heat sheet, event info page — no login needed
- Explicitly excluded: spectator ticketing/payment, vendor accounts, past-events archive, admin analytics beyond outstanding-scores tracking

**Phase 2 (only after a successful first event):**
- Spectator fee/ticketing
- Past events archive + per-athlete results history
- Multi-event organizer dashboard (if running events for other organizers)

**Phase 3 (only if this becomes a real product):**
- Self-serve organizer signup, multi-tenant billing — the resale path

## Competitive reference

See memory `reference-scoreit-assessment` for concrete ScoreIT gaps to differentiate on: broken page-height/scroll layout on the registration step, non-functional leaderboard buttons in testing, stale/unfinished copy, and event pages left empty despite being imminent. Wodflow's pre-event dry-run and offline-first scoring are direct answers to the failure modes actually observed.
