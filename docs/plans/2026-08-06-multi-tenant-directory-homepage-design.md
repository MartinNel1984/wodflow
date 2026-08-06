# wodflow.co.za multi-tenant directory homepage — design

**Date:** 2026-08-06
**Status:** Design only — explicitly NOT to be built or shipped until after the Oct 2–4 Rumble "The Big One" event. Revisit then.

## Problem

`wodflow.co.za` and `rumbleinrandburg.co.za` are currently the exact same
deployment with zero host-based branching — both are `custom_domain`
routes on the one Cloudflare Worker, and every page unconditionally
renders Tjokkie's Rumble Series branding regardless of which domain was
hit. Multi-tenancy exists in the schema (`organizations` table,
migration-026) but in practice there's only one real org — the ATG
backfill assigned every row to it.

Once a second box ("client #2") signs on, `wodflow.co.za` needs to stop
being a second copy of Rumble's site and become what it's actually meant
to be: the platform's own home — a directory of every box running on
Wodflow, a pitch for prospective boxes, and the landing point for the
referral mechanic Tjokkie asked for.

## Audience

Two audiences, roughly equal weight, on one page:

1. **Prospective boxes** — gym owners/organizers evaluating whether to
   run their next comp on Wodflow. Needs credibility (real boxes already
   using it) and a clear "why us" pitch.
2. **Athletes** browsing across boxes — want to find upcoming comps
   anywhere on the platform, not just at a box they already know.

## Architecture — hostname-based branching

The root route (and several other public routes — see the domain-scoping
audit below) decides what to render purely from the incoming `Host`
header:

1. **A box's own domain** (e.g. `rumbleinrandburg.co.za`) → renders that
   box's existing branded homepage, byte-identical to today. Verified via
   a real before/after HTML diff against the live site before shipping —
   this is the one part of the whole feature that must be provably zero-risk,
   since it's the box's actual live storefront.
2. **`wodflow.co.za`** (the generic/platform domain, and any future
   visitor arriving without a known custom domain) → renders the new
   multi-tenant directory.
3. **Any future box's own domain** → same as #1, a different org.

New DB piece: `organizations.custom_domain text` (nullable). A single
column, not a table — no box needs more than one hostname today, and a
second-domain-per-box requirement can be added later without disrupting
this design (YAGNI).

**Onboarding a new box (manual, by Martin):** register/point their domain
at Cloudflare → add it as a custom domain route on the Worker (same
`wrangler.jsonc` + deploy step already used for `rumbleinrandburg.co.za`)
→ set `organizations.custom_domain` for their org via the existing
platform-admin console (`/platform/control` — add one field to the org
edit form). A few manual minutes per box. Confirmed explicitly: **not**
building self-service domain onboarding — at the volume of boxes expected
near-term, manual is faster to build, faster to run, and avoids building
tooling nobody's asked for yet. Domain ownership (client buys their own
vs. Martin buys and bills it) is decided case by case per client, no
platform logic depends on which.

## Domain-scoping audit — other pages assuming single-tenant

Before any of this ships, every public route that currently lists content
across the whole platform (and only looks correct today because there's
exactly one real org) needs the same domain-awareness as the homepage.
Found by grepping every public (non-admin) route for unscoped queries:

| Route | Current behavior | Risk once box #2 exists |
|---|---|---|
| `/all-events` | Queries `events` across every org, no filter | Shows every box's events mixed together |
| `/past-rumbles` | Queries `historical_events` across every org, no filter | Same — mixes box #2's history into Rumble's page |
| `/tickets` | Queries every org's ticketed events, no filter | Same |
| `/judge-login` | Resolves org from an `?org=<slug>` query param; auto-picks the org **only** when exactly one active org exists | **Breaks outright**, not just mixes content — the plain link Tjokkie's judges actually use (no `?org=`) starts returning "Open the judge link your organiser sent you" the moment a second org goes active |

**Not gaps, for contrast:** `/events/[eventId]`, `/leaderboard/[divisionId]`,
`/heats/[divisionId]`, `/register/[eventId]`, `/tickets/[qrToken]` — all
scoped by a specific ID in the URL already, so they work correctly
regardless of which domain loads them. A shared link or QR code should
work from any device — that's intended, not a leak.

**Fix — one shared primitive, not five separate patches:** a single
server-side helper, `resolveOrgFromHost(host)`, that looks up
`organizations.custom_domain` (falling back to "no match → platform-wide"
for `wodflow.co.za` itself). Every route above switches to it:

- `/`, `/all-events`, `/past-rumbles`, `/tickets` — filter their query by
  the resolved org id; on `wodflow.co.za` (no match) `/` renders the
  directory instead of filtering, while `/all-events`/`/past-rumbles`/
  `/tickets` show the cross-box combined list (see below).
- `/judge-login` — resolves org from the hostname first, only falling
  back to the `?org=` param / the "needsOrg" prompt when hit from
  `wodflow.co.za` directly (which has no single implied org). This closes
  the judge-login break entirely — a judge visiting their box's own
  domain never sees "needsOrg" again, regardless of how many boxes exist
  platform-wide.

## Directory page content (`wodflow.co.za`)

**Box cards** — one per active org that has `custom_domain` set (orgs
mid-onboarding without a domain yet don't show — no half-finished box on
display). Each card:
- Box logo + name (reusing the existing `brand_kits` logo — the same
  asset already used on their own homepage)
- Their next published/upcoming event's name + date, queried live; if
  they have none, the card just omits that line rather than showing "no
  events" (quiet empty state, same pattern as the past-rumbles page)
- Click anywhere on the card → their own domain (external link, leaves
  `wodflow.co.za` entirely)

**Combined "Upcoming Events" section**, below the cards — every published
event across every box with a `custom_domain`, sorted by date ascending,
each row linking to that event's `/events/[eventId]` detail page **on the
box's own domain**, not `wodflow.co.za` — so a click always lands on the
box's real branded site to register, matching where its card also leads.
Reuses the existing event-detail-page feature (08-01/08-02) — no new page,
just a cross-box query using the same `resolveOrgFromHost` fallback
behavior described above.

## "Why Wodflow" section

Sits on the `wodflow.co.za` hero, squarely for the prospective-box
audience. Concrete, provable claims — never naming a specific competitor
by name, referring to "other platforms" generically — since every one of
these is something already built and tested, not marketing fluff:

**Reliability:**
- Built on Cloudflare's global edge network with real server-rendered
  pages — not a single server with no backup.
- Offline-safe judge scoring — a judge's phone can lose signal mid-WOD
  and every score still saves locally and syncs the moment connection
  returns, tested for real with a dropped connection, not just claimed.
- Full security hardening (encrypted throughout, modern web security
  headers) — most small competition platforms skip this.

**Built with real organizers, not for them in the abstract:**
- Season-long standings across multiple events, not just single-event
  leaderboards — RX and Not So RX'd scored correctly, points formulas
  organizers can configure themselves.
- A real athlete portal — persistent accounts, registration history,
  "Best Finishes" across every comp done on the platform.
- Digital waivers, spectator ticketing with QR gate check-in, live heat
  sheets — the whole event-day operation in one place.

**Made for gyms running their own show:**
- Every box gets its own branded homepage on its own domain — Wodflow
  runs invisibly underneath. Their platform, their brand.
- Multi-tenant from day one — a feature built for one box benefits every
  box immediately.

## "Powered by Wodflow" referral badge

Confirmed by Tjokkie (2026-08-06 pricing reply) as the referral mechanism
he wants: a **prominent** badge on every box's own branded homepage
(replacing the current quiet "Infrastructure managed by Wodflow" footer
line, which is too subtle to function as a referral driver). Clicking it
goes to a dedicated landing page — not the directory page itself — pitched
as "Host your next comp through us," built from the "Why Wodflow" content
above plus a clear next-step CTA (contact/signup). This is the mechanism
Tjokkie's 30%-of-setup-fee referral commission depends on, so it needs to
read as an invitation, not a credit line.

## Visual direction

Follows the platform's existing mural-wall visual language (dark wall,
glow accent, hand-drawn linework, script accent) rather than inventing a
new look — but in **Wodflow's own** brand kit (flame orange-red, Anton/
Hanken Grotesk), not any individual box's colors, since this page
represents the platform, not one client. This is the first real content
Wodflow's own brand identity gets — every other branded surface so far
belongs to a specific box — so it's worth a deliberate design pass
(`design-review`/`frontend-design` skills) when built, not a quick reskin.
Box cards use a responsive grid, reusing the "shrink to fit, no
horizontal scroll" pattern already proven on the past-rumbles logo layout
(08-05).

## Rollout plan

1. **Not before the Oct 2–4 event.** Nothing in this doc gets built until
   after Rumble "The Big One" wraps, confirmed explicitly by Martin.
2. When resumed: `organizations.custom_domain` migration first, backfill
   ATG → `rumbleinrandburg.co.za`.
3. Build `resolveOrgFromHost` and wire it into `/`, `/all-events`,
   `/past-rumbles`, `/tickets`, `/judge-login` together — the domain-
   scoping fix and the new directory page share this one primitive, so
   they should ship as one coordinated change, not the directory first
   and the audit fixes later (which would leave the gaps live longer than
   necessary).
4. Build the directory page content + "Why Wodflow" + referral landing
   page.
5. Add the "Powered by Wodflow" badge to the shared homepage-footer
   component (used by every box), replacing the current quiet credit
   line.
6. **Verification before shipping:** real before/after HTML diff of
   `rumbleinrandburg.co.za`'s homepage (must be byte-identical apart from
   the new badge); real judge-login test with no `?org=` param on
   Rumble's domain; confirm `/all-events`, `/past-rumbles`, `/tickets`
   each show only Rumble's content when visited via
   `rumbleinrandburg.co.za`, and the combined cross-box view when visited
   via `wodflow.co.za`. All of this only matters once box #2 is real
   enough to test against — until then the directory has one box in it,
   which is expected and fine.

## Explicitly out of scope for this round

- Self-service domain onboarding (manual is the deliberate choice, see
  Architecture section).
- Any change to registration, scoring, payments, heats, or anything
  event-day-critical — this is a homepage/discovery layer only.
- A second domain per box.
- Building/shipping anything before the Oct event.
