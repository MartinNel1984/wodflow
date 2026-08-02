# Homepage persona fork — design

**Date:** 2026-08-02
**Status:** Approved, ready for implementation

## Problem

wodflow.co.za's homepage has a single CTA ("Enter Rumble Series →") that
sends every visitor into the same `/all-events` → event card → Register
flow, regardless of why they're actually visiting. This works fine for
athletes, but:

- **Spectators** have no discoverable path to buy a ticket at all. The
  only link is buried inside the athlete registration wizard
  ("Not competing? Get a spectator pass →"), and only shows up if the
  organizer has set a spectator price on that specific event.
- **Judges** have no homepage entry point (`/judge-login` is only linked
  from the bottom of `/all-events`).
- **Organizer sign-in** exists but is buried in the page footer, below
  News/Photos/Social.

## Solution

Replace the homepage hero's single CTA with a clear persona fork:
two primary buttons (Athlete / Spectator) and two secondary links
(Judge / Organizer), plus one new page for spectator ticket discovery.

## Changes

### 1. Homepage hero (`app/page.tsx`)

Replace:

```tsx
<a href="/all-events" className="rumble-cta rumble-display">
  Enter Rumble Series →
</a>
```

With two primary buttons (stacked on mobile, side by side on larger
screens), styled with the same two `rumble-cta` treatments already used
for the Leaderboard/Heats button pair (one bright/solid, one outlined):

- **"I'm Competing →"** → `/all-events` (unchanged destination)
- **"I'm Spectating →"** → `/tickets` (new page, see below)

Below the button pair, a secondary row matching `/all-events`'s bottom
link styling:

- **"Judge sign-in"** → `/judge-login`
- **"Organizer sign-in"** → `/login`

This replaces the current footer-only "Organizer sign-in" link, which
moves up here instead. The rest of the homepage (Leaderboard & Heats,
News, Photo carousel, Social, footer branding) is untouched.

### 2. New `/tickets` page (`app/tickets/page.tsx`)

A new server component, modeled on `app/all-events/page.tsx`'s existing
data-fetch and card-rendering pattern:

- **Query**: `events` where `status IN ('published', 'live')` AND
  `spectator_price IS NOT NULL`.
- **Each card links directly to `/events/[eventId]/tickets`** (the
  existing buy flow) — not the athlete-facing `/events/[eventId]` detail
  page. A spectator already knows what they want; routing them through
  the detail page first would be an unnecessary extra click. The detail
  page's own "Buy tickets" button is untouched for anyone who lands
  there first via `/all-events`.
- **Empty state**: when the query returns zero events, show a centered
  message — "No tickets on sale right now — check back soon." with a
  link back to `/`, matching the tone/style of the homepage's existing
  "Leaderboard opens soon" empty state.
- **Header**: "Buy Tickets" title with brief subtext ("Come watch the
  action — spectator passes for upcoming events.").
- Reuses the same card component/styling `/all-events` uses (including
  brand-kit-aware posters/logos) — no new visual treatment needed.

### 3. Judge / Organizer links

Purely link additions on the homepage, matching `/all-events`'s existing
"Judge sign-in" / "Organizer sign-in" link styling exactly. No changes
to `/judge-login`, `/login`, or any auth logic.

## Explicitly out of scope

- No database or RLS changes.
- No changes to the PayFast webhook, QR/check-in flow, or the
  registration wizard's own spectator-pass link — those keep working
  exactly as today.
- No special-casing for `isBigOne`-branded events on `/tickets` beyond
  whatever `/all-events`'s existing card component already does for
  brand kits.
- No filtering/sorting beyond the same list-all pattern `/all-events`
  already uses for multiple concurrent events.

This is a small, additive feature — one hero-section edit and one new
listing page, both purely front-end. No existing flow's internals
change, only how visitors arrive at flows that already work and were
verified live earlier today.
