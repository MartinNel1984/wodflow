# Event poster cards — design

Driven by organizer feedback (Tjokkie, ATG Fitness) comparing Wodflow's event listing to
CaptureFit's richer, poster-driven event cards. Two asks: bring more brand identity into the
registration flow, and show "meer vleis" (more detail — image + description) about each event
on the homepage.

## Data & storage

- `events` gains two columns: `description` (text) and `poster_url` (text, public URL).
- New Supabase Storage bucket `event-posters`: public read, write restricted to organizers
  (`is_organizer()`, same check used everywhere else in RLS).
- Upload happens client-side: organizer picks a file, it uploads directly to the bucket via the
  browser Supabase client (authenticated, so RLS allows it), we get a public URL back, and that
  URL is saved onto `events.poster_url` via a normal server action form submit — no server-side
  image processing in v1.
- Client-side validation before upload: image files only, capped at 5MB (avoid a slow load on
  athletes' phones at the venue from an unresized photo).

## Where organizers manage it

Added to the existing "Settings" section on the per-event checklist page
(`/events/[eventId]/checklist`) — description textarea + poster upload control, alongside the
judging-mode/payment-provider settings already there. Not a new page, not on the events list.

## Public display

**Homepage event card** — redesigned from a thin logo+text row into a taller poster-forward
card: full-width poster image (16:9, `object-cover`), event name (Anton display font), dates +
venue (Space Mono), description truncated to ~3 lines (`line-clamp-3`), brand kit tagline as a
small accent-colored line. **Fallback:** events with no poster uploaded keep today's compact row
layout — no broken-image placeholder, the redesign is additive only.

**Register page** — poster shown as a banner above "Choose your division," with description as
a short paragraph. This is the primary answer to "bring in colors here" — the poster itself
carries the event's real visual identity (whatever the organizer's designer put in the flyer),
which is a stronger, more authentic signal than trying to tint UI chrome further. Same fallback
rule (no poster → no image, existing plain header).

**Confirmation page** — smaller version of the same poster + event name above "You're in!",
reusing the brand-kit fetch already added there.

## Upload UX & error handling

- Upload button disabled + "Uploading…" state while in flight, prevents double-submit.
- Failure (network, RLS rejection, missing bucket): clear inline error, existing poster (if any)
  untouched.
- Success: hidden field populated with the public URL, form submits normally alongside
  description through one server action.
- Replacing a poster just overwrites `poster_url`; no cleanup of the orphaned old file in v1
  (storage cost is trivial at this scale).

## Rollout

SQL migration (columns + bucket + RLS policies) pasted into the Supabase SQL editor by Martin,
same pattern as the last two migrations — no dashboard clicking needed for bucket setup, it's
all in the SQL. Code pushed after the migration is confirmed run.

## Verification

Type-check + build locally. Since this is Wodflow's first real client-side file upload, also
exercise it live via Chrome: upload a test image, confirm it renders on the homepage card,
register page, and confirmation page, and confirm the no-poster fallback still looks right on an
event that hasn't uploaded one.
