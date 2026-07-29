# Rumble Series hub — design doc

**Date:** 2026-07-29
**Status:** Validated with Martin, not yet built.

## Context

Tjokkie's next event, "The Big One" (Oct 2–4 2026, teams of 2 same gender), needs a
public-facing marketing hub — not another admin/scoring feature, but the first thing a
visitor to `wodflow.co.za` sees. Source material: `Rumble CI.pdf` (4 sub-brand logo/color/
font specs — Rumble Series, Remix, Indy, The Big One, all sharing one crown+R mark) and
`RUMBLE Big One Social temp.pdf` (near-blank social template, logo lockup + dates only,
no real event photography yet).

Wodflow already has `brand_kits` and `series`/`series_events` tables (migration-007,
migration-012) from the 2026-07-20 Rumble Series platform design — this doc only adds
what's missing: a public hub page and a couple of small supporting tables. No scoring/
workout/indemnity changes.

## Data issue found during discovery

The live event "Rumble in Randburg" (Oct 2–4 2026 — same dates as The Big One) is
currently assigned the **"Rumble Indy" brand kit** (red/orange, individual-athlete
branding) instead of a Big One kit (blue, teams-of-2). No Big One or Remix kit exists yet,
and the existing Indy kit's `logo_url` is null. This gets fixed as part of this work
(§ Data changes).

## Real assets extracted

Poppler/pdfimages weren't available locally; PyMuPDF was used to render the CI PDF pages
at high resolution (preserves original layer compositing) and OpenCV flood-fill (from the
four corners, `FLOODFILL_FIXED_RANGE` to prevent color creep across anti-aliased edges)
knocked out the white background to transparency without eating into the logo's internal
white details (the R's counter, the wordmark, the crown gaps). Two variants extracted:

- **Rumble Series main logo** (crown + R + lightning, no athlete figure) — used for the
  hub hero.
- **"The Big One" logo** (same mark + barbell overhead-press athlete illustration) — used
  as the Big One `brand_kits.logo_url`, appears on the event's registration/leaderboard/
  scoresheet pages per the existing brand-kit rendering (migration-007).

Confirmed palettes/fonts directly from the CI doc:
- Rumble Series / Big One: `#3552A4` / `#00AEEF` / `#2E3192`
- Remix: `#662D91` / `#AB218E` / `#EC008C`
- Indy: `#ED1C24` / `#F9A01B`
- Fonts named in the doc (Zombie Punks, Street Punks Marker, Punch Condensed, Rockybilly)
  are not free web fonts and aren't in hand yet — Martin is tracking down the real font
  files. Built with close free Google Fonts substitutes in the meantime, swappable later
  with no layout risk.

## Routing

`wodflow.co.za` (root `app/page.tsx`) becomes the Rumble hub — full Rumble branding, no
wodflow mural styling. The current homepage content (live-events list + athlete/judge/
organizer sign-in) moves unchanged to `wodflow.co.za/all-events`, reached via a "Rumble
Series →" CTA on the hub. Registration, leaderboard, judge, and admin routes are
untouched.

## Hero — total Rumble takeover

Full-bleed, full-viewport-height. The Rumble Series logo rendered large — dominant, not a
small centered lockup. Dark backdrop (own CSS, not a reskin of `.graffiti-page`), with
Rumble's own crown/"XX" tag-mark linework as background texture (not wodflow's hex/
kettlebell motif), and a `#00AEEF` glow instead of wodflow's flame-orange. Tagline
("Yeeeah! Get Some!") and event dates sit below the mark. This dark Rumble-blue identity
carries through every section below the fold — no wodflow-orange styling appears
anywhere on this page.

## Page sections (top to bottom)

1. **Hero** — as above.
2. **"Rumble Series" CTA** → `/all-events`.
3. **Leaderboard/Heats** — live data (existing `public_leaderboard` view + heats routes,
   scoped to the Big One's divisions) during event days; a "Leaderboard opens Oct 2nd"
   teaser outside that window. Degrades to the teaser state, never an empty/error table.
4. **News** — auto-generated milestone strip ("Registration open" / "Heats released" /
   "Results live") driven off existing event/heat status fields. No manual authoring.
5. **Photo carousel** — real ATG/Rumble event photos (Martin supplying), backed by a new
   `hub_photos` table + Storage bucket.
6. **Social** — Instagram (+ Facebook if available) follow buttons/icons, link-out only.
   No live embed / API integration for now — deferred, revisit later.
7. **Footer** — reuses wodflow's existing footer (organizer sign-in etc.).

Sections 3–6 all render a graceful empty/teaser state rather than erroring when data
isn't there yet.

## Data changes (migration-036)

- New `brand_kits` row: "Rumble Big One", palette `#3552A4`/`#00AEEF`/`#2E3192`, tagline
  "Yeeeah! Get Some!", `logo_url` set after upload.
- Reassign `events.brand_kit_id` for "Rumble in Randburg" from the Indy kit to the new
  Big One kit.
- New `series` row: "Rumble Series 2026" (table existed, unused until now — populates it,
  hook for a future season leaderboard; no public read policy added yet, nothing reads it
  publicly on the hub itself).
- New `hub_photos` table (`id`, `image_url`, `caption` nullable, `sort_order`,
  `created_by`, `created_at`), RLS: public select / organizer write — same shape as
  `brand_kits`.
- New Storage buckets `brand-kit-logos` and `hub-photos` (public read, organizer write),
  following the `event-posters` bucket pattern from migration-024.

## Testing

- Real browser check of the hub at `/`, the relocated list at `/all-events`, and that
  registration/leaderboard/scoresheet pages for "Rumble in Randburg" now render the
  correct blue Big One branding instead of Indy red/orange.
- Confirm leaderboard/heats section shows the teaser state now (pre-event) and would
  show live data once heats exist for the Big One's divisions.
- Mobile responsiveness pass on the hero and carousel specifically — full-bleed hero
  content is the highest risk for mobile overflow/cropping.
