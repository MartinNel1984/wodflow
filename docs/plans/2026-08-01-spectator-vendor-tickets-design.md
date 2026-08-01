# Spectator + Vendor Ticket Sales — Design

**Date:** 2026-08-01
**Status:** Approved, ready for implementation planning

## Why

Live competitive comparison against ScoreIT (see memory / chat 2026-08-01) found Wodflow has no way to sell spectator day-passes or vendor spots — ScoreIT does, with per-day pricing, VIP parking add-ons, and a cart. This is a real, currently-uncaptured revenue stream for every Wodflow organizer (Tjokkie/ATG now, future boxes later). Martin frames this project's total opportunity at ~R300k of business "if we get it right" — treat this feature's quality bar accordingly, not as a quick bolt-on.

## Scope decisions (confirmed with Martin)

- **Flat pricing, not ScoreIT's per-day/VIP-parking variant model.** One "Spectator price" and one "Vendor price" per event. No stock caps, no cart, no multiple ticket tiers. Ships fast, matches the existing `events.default_price` simplicity pattern.
- **Minimal buyer info:** name, email, quantity. No account required, no waiver. This is not an athlete registration — friction should match a R70 day-pass purchase, not a competition entry.
- **Opt-in per event**, configured in the existing checklist/Settings page alongside `judging_mode`/`payment_provider`. Blank price = that ticket type disabled; no forced default.
- **QR-code gate check-in is in scope for v1** (not deferred) — auto-decrementing per purchased quantity, with a manual confirm-tap required after each successful scan.

## Data model

New table `event_tickets` — one row per *purchase* (not per attendee), since we're not collecting per-attendee names:

```sql
create table event_tickets (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references events(id) on delete cascade,
  ticket_type         text not null check (ticket_type in ('spectator','vendor')),
  buyer_name          text not null,
  buyer_email         text not null,
  quantity            int not null check (quantity > 0),
  unit_price          numeric(10,2) not null,   -- snapshot at purchase time
  price_paid          numeric(10,2) not null,   -- quantity * unit_price
  payment_status      text not null default 'pending' check (payment_status in ('pending','paid','refunded')),
  payfast_payment_id  text,
  paid_at             timestamptz,
  qr_token            text not null unique default encode(gen_random_bytes(16),'hex'),
  checked_in_count    int not null default 0,
  created_at          timestamptz not null default now()
);
```

Two new nullable columns on `events`: `spectator_price numeric(10,2)`, `vendor_price numeric(10,2)`.

RLS: scoped to the event's `organization_id` via the same join pattern used by every table since migration-026. Since this is a brand-new table there's no legacy policy to conflict with (unlike the `profiles` privilege-escalation bug from two separate policies) — still verify with an RLS test script before shipping, same standard as `verify-m9-rls.mts`.

## Checkout flow

New public page `/events/[eventId]/tickets`, linked from the event page whenever `spectator_price` or `vendor_price` is set (404s cleanly if neither is set). Buyer picks type (only enabled types shown), enters name/email/quantity, sees the total, pays.

Reuses PayFast (Yoco fully removed per migration-043). `lib/payfast.ts`'s `createPayfastCheckout()` gets generalized from its current registration-shaped params to a generic `{ id, itemName, amountRands, buyerName, buyerEmail }` — registrations call it with the same reshaped args, no behavior change there.

**Webhook:** `app/api/payfast/route.ts` currently assumes every `m_payment_id` is a `registrations.id`. Ticket payment IDs get a `ticket_<uuid>` prefix so the webhook branches to `event_tickets` vs `registrations` before doing its lookup. Same idempotency pattern already proven on registrations: conditional `.neq("payment_status","paid")` update, re-check what actually changed before sending the confirmation email (prevents the double-email class of bug already fixed once on this project). Fail-closed on amount mismatch, same `> 0.5` tolerance check.

Confirmation email (via `lib/email.ts`) is sent once `payment_status` flips to `paid`, containing a link to the ticket page — not an inline QR image, since SVG/canvas renders unreliably across email clients.

## QR ticket + gate check-in

Public page `/tickets/[qr_token]` (token-as-credential, same pattern as existing team-invite links) renders the QR client-side (small canvas-based JS lib) plus buyer name/type/quantity as a human-readable fallback. Unpaid tickets never get emailed a link — no scannable code exists for something never paid.

New admin-only page `/events/[eventId]/checkin` (linked from AdminNav), opens the device camera (`BarcodeDetector` API with a JS fallback), decodes a scan, resolves the token, and shows a confirm card: "Jane Smith — Spectator ×4 — 2/4 checked in" with a manual tap required to commit (catches a mis-scan before it counts, same two-step-confirm philosophy as the existing heat-lock correction flow).

On confirm: if `checked_in_count >= quantity`, reject with "Already fully used — 4/4 checked in." Otherwise increment by 1. This lets a group split up and arrive separately (the realistic case) while still hard-blocking entry beyond what was actually paid for. No per-scan audit log in v1 — the counter is enough; additive migration later if a real dispute ever needs one (YAGNI).

## Testing plan

Real functional test end-to-end in a browser, not just a passing build: buy a real spectator ticket (seeded `paid` row if PayFast has no usable sandbox, per the project's existing PayFast-sandbox limitation), confirm the email/ticket page renders, scan the QR with an actual phone camera against the check-in page, confirm the counter increments correctly and blocks once quantity is exhausted. RLS verified independently (query `pg_policies`/read the row back), not by trusting "Success. No rows returned."

## Explicitly out of scope for v1

- Per-day/VIP-parking ticket variants, stock caps, multi-item cart (ScoreIT has these; flagged as a possible v2 if this proves out).
- Per-attendee names/waivers for spectators.
- Per-scan audit log.
