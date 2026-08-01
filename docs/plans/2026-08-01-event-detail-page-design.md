# Public Event Detail Page — Design

**Date:** 2026-08-01
**Status:** Approved, ready for implementation planning

## Why

Live competitive comparison against ScoreIT (see [[project-scoreit-replacement-pitch]] / chat 2026-08-01) found ScoreIT's event pages are a full self-contained pitch (schedule, venue, rules, what's included, waiver), while Wodflow sends people straight from a short teaser card into the registration wizard with no stop to actually read about the event first.

## Scope decisions (confirmed with Martin)

- **Markdown support**, not plain text-only. `events.description` stays the same column — no new field — but gets rendered as markdown (headings/bold/bullet lists) instead of raw prose, so organizers can structure schedule/rules/what's-included the way ScoreIT organizers do in one write-up.
- **Card click goes to the new detail page first**, not straight into registration. The detail page has its own clear "Register" button into the existing wizard. Direct links to `/register/[eventId]` (e.g. from an email) still work unchanged — the detail page is an added stop, not a replacement for the wizard.
- **Full waiver text shown on the page**, not just a "you'll sign this later" note — `events.waiver_text` already exists and is captured at registration; showing it upfront is better practice for a liability waiver, letting a minor's guardian read it before committing to pay.

## Page content — `/events/[eventId]` (public, no auth)

- Poster image (if set) + event name + dates, styled with the event's brand kit (same pattern already used on register/leaderboard pages).
- Structured facts already captured today: venue name/address, contact email/phone.
- The markdown `description` rendered properly — this is where schedule/rules/what's-included live as one flowing write-up, no new structured fields.
- Full `waiver_text`, read-only, its own clearly-labeled section.
- "Buy tickets" link to `/events/[eventId]/tickets` whenever `spectator_price`/`vendor_price` is set (from the ticket-sales feature).
- A prominent "Register" button → `/register/[eventId]` (existing wizard, untouched).

## Where it's linked from

Every existing event-card "Enter Now" click (`/all-events`, the Rumble hub homepage) changes its `href` from `/register/[eventId]` to `/events/[eventId]` — a one-line change per card site, no new card components needed.

## Implementation notes

- Needs one small new dependency: a lightweight markdown-to-JSX renderer (e.g. `react-markdown`, no plugins) — not a rich-text editor. The organizer still types into the existing plain `<textarea>` on the checklist form, just using markdown syntax now.
- No new schema, no new payment logic, no registration-flow changes. Low-risk relative to the ticket-sales feature — the only genuinely new surface is the page itself and the markdown renderer.

## Testing plan

Real browser check: an event with a full markdown description + waiver text renders correctly (headings/bold/bullets show up, not raw asterisks), the Register button lands in the existing wizard unchanged, an event with no description/waiver still renders cleanly (no blank sections), and the ticket link only appears when pricing is actually set.
