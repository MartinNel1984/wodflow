# Wodflow — Multi-tenancy design

**Date:** 2026-07-28
**Status:** Approved, implementing

## Why

Wodflow currently has one paying organizer (ATG Fitness / Tjokkie). The schema and RLS
policies are single-tenant: `is_organizer()` checks `profiles.role = 'organizer'` globally,
with no notion of which box an organizer belongs to. Any organizer account can read/write
every event, athlete, and score on the platform. This is fine with one customer; it breaks
(and becomes a POPIA problem, since indemnity/waiver PII is involved) the moment a second
box is onboarded.

This design adds organization-scoped multi-tenancy plus an unlisted platform-admin page
for Martin (DraftTwo) to manage boxes, matching the Platform Fee / license model already
drafted in `Wodflow - Ownership, License and Platform Fee Clauses.pdf`.

## Decisions made

- One organizer profile belongs to exactly one organization (no shared/multi-org accounts).
- Judges and head-judges are also scoped to one organization (boxes recruit their own judges).
- Athletes remain global — one athlete profile can register at multiple boxes' events.
- Platform admin is a 4th `profiles.role` value (`platform_admin`), not an email allowlist.
- Admin page lives at an unlisted URL, not linked in any nav.
- Admin page includes a stats snapshot: total boxes, total athletes, total events (+ optional
  registrations/revenue).
- Admin page supports full org creation + first-organizer invite flow (not read-only v1).
- Invite delivery reuses the existing `team_invites` token-link pattern — Martin generates a
  link and sends it manually (WhatsApp/email), no transactional email infra.
- Suspending an org freezes organizer/judge dashboard access entirely. Public-facing pages
  (leaderboard, registration) for that org's already-published events stay live by default,
  so athletes aren't stranded mid-event over a billing dispute with the box.

## Data model

### New table: `organizations`
```sql
id           uuid primary key default gen_random_uuid()
name         text not null
slug         text unique not null
status       text not null default 'active' check (status in ('active', 'suspended'))
created_at   timestamptz not null default now()
```

### `profiles` changes
- `organization_id uuid references organizations(id)` — set for organizer/judge/head_judge,
  null for athlete and platform_admin.
- `role` check constraint extended: `check (role in ('organizer', 'judge', 'head_judge',
  'athlete', 'platform_admin'))`.

### `events` changes
- `organization_id uuid not null references organizations(id)` — the tenancy root. Every
  dependent table (divisions, registrations, registration_athletes, heats, heat_assignments,
  judge_assignments, scores, series, brand_kits, event_poster_cards) already hangs off
  `event_id`, so it inherits org scoping through `events` via RLS joins rather than needing
  its own `organization_id` column.

### New table: `org_invites`
```sql
id               uuid primary key default gen_random_uuid()
organization_id  uuid not null references organizations(id)
email            text not null
role             text not null check (role in ('organizer','judge','head_judge'))
token            uuid not null default gen_random_uuid()
status           text not null default 'pending' check (status in ('pending','accepted','expired'))
invited_by       uuid references profiles(id)
created_at       timestamptz not null default now()
accepted_at      timestamptz
```

## RLS rewrite

New helper functions:
- `is_platform_admin()` — `role = 'platform_admin'`.
- `my_organization_id()` — caller's `profiles.organization_id`.
- `is_organizer_for(org_id)` / `is_privileged_for(org_id)` — role matches AND
  `organization_id = org_id` AND the org's `status = 'active'`.

Every policy that currently reads `using (is_organizer())` (events, divisions, registrations,
registration_athletes, heats, heat_assignments, judge_assignments, scores, series, brand_kits,
event_poster_cards, team_invites) changes to
`using (is_organizer_for(<resolved org_id>) or is_platform_admin())`, resolving org_id by
joining through `event_id` where the table doesn't carry it directly.

`profiles` select policy changes so an organizer/judge only sees profiles within their own
`organization_id` (plus their own row) — this is the actual PII fix, since today any
organizer sees every profile platform-wide. `platform_admin` bypasses all scoping.

## Migration path for existing ATG data

1. Insert one `organizations` row for ATG (`Against The Grain Fitness`, slug `atg`, active).
2. Backfill `organization_id` on all existing `profiles` rows with role in
   (organizer, judge, head_judge) to ATG's org id.
3. Backfill `organization_id` on all existing `events` rows to ATG's org id, then add
   `not null`.
4. Flip Martin's own profile to `role = 'platform_admin'`, `organization_id = null`.
5. Ship as one numbered migration (`supabase/migration-026-multi-tenancy.sql`): schema +
   backfill + rewritten RLS together, per existing migration convention.
6. Verify: with only one org, this should be a no-op for Tjokkie. Real test is creating a
   second dummy org in Supabase and confirming its data is invisible to ATG's organizer
   login and vice versa, before onboarding a real second box.

## Platform admin page

- Route: `/platform/<unlisted-slug>` (not `/admin`), gated by `role = 'platform_admin'` via
  RLS and a server-side redirect for non-admins, not linked from any nav.
- Dashboard: total boxes (active/suspended split), total athletes, total events (by status),
  optional total registrations + platform-fee revenue sum.
- Organizations table: name, status badge, organizer count, event count, created date,
  active/suspended toggle (confirm-before-suspend).
- Create org + invite flow: form creates `organizations` row, then generates an `org_invites`
  row with a token; admin page shows the resulting `/invite-org/[token]` link to copy and
  send manually. New accept page lets the invitee set a password via Supabase auth signup,
  and on success creates their `profiles` row with `role='organizer'` and the invite's
  `organization_id` (extends the existing `handle_new_user` trigger pattern to read the
  invite token from user metadata).

## Open items / assumptions to revisit

- Whether suspended orgs' public event pages should also go dark (currently: no).
- Whether `org_invites` needs an expiry timestamp/TTL enforcement beyond `status='expired'`
  (currently: status field exists but no automatic expiry job — fine at current volume).
