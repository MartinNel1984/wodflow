# Judge Signup Form — Design

**Date:** 2026-08-03
**Status:** Approved, ready for implementation

## Why

Tjokkie wants to replace the homepage's "Judge sign-in" link with a public volunteer-recruitment form for Rumble in Randburg (Oct 2-4 2026). Judge sign-in (the PIN-based login judges use to score heats during the event) isn't relevant pre-event — what's needed now is a way for people to put their hand up to judge, so organizers can build a roster ahead of time.

This is deliberately separate from the existing `/judges` admin page and `profiles`-based judge accounts (which create real login credentials for scoring) — a judge application is just a volunteer expressing interest, with no login, no PIN, no role.

## Scope decisions (confirmed with Martin)

- **Tied to a specific event** — an application records which event the person is applying to judge, not a general series-wide list.
- **Fields:** name, surname, email, cell, t-shirt size (dropdown: S/M/L/XL/XXL), "have you judged before?" checkbox. All required except the checkbox.
- **No dedup** — duplicate submissions (same email, same event) are allowed; not worth the complexity for a volunteer form.
- **No email notifications** — submitting shows an inline "Thanks, we'll be in touch" message. No confirmation email to the applicant, no notification email to the organizer.
- **Admin visibility:** new "Judge Signups" nav tab → event/division-style picker page (mirrors the existing `/leaderboards` and `/workouts` jump-off pages) → per-event list of applicants.
- **Homepage:** the "Judge sign-in" link (small text row under the two hero CTAs) becomes a "Judges" link pointing at `/events/{flagshipEventId}/judge-signup`. `/judge-login` itself is untouched — judges still need it at the event.

## Data model

New table `judge_applications` — one row per submission:

```sql
create table judge_applications (
  id             uuid primary key default gen_random_uuid(),
  event_id       text not null references events(id) on delete cascade,
  first_name     text not null,
  last_name      text not null,
  email          text not null,
  cell           text not null,
  tshirt_size    text not null check (tshirt_size in ('S','M','L','XL','XXL')),
  judged_before  boolean not null default false,
  created_at     timestamptz not null default now()
);
```

RLS: public (anon, via service-role insert — same pattern as `event_tickets`/`registrations`) can insert; select restricted to the event's organizer/head_judge, same `is_privileged_for(organization_id)` join pattern used everywhere else.

## Routes

- `POST /api/judge-applications` — validates required fields, inserts via service client, returns `{ ok: true }` or a 400 with an error message. No payment, no PayFast, no QR token — the simplest possible insert-and-confirm, closer to a contact form than a purchase flow.
- `GET /events/[eventId]/judge-signup` — public page, 404s if the event isn't published/live (same gate as tickets/registration). Renders a client form component; on successful POST, swaps the form for a thank-you message in place (no navigation).
- `GET /judge-applications` — admin picker page, lists events → per-event "View applicants" link (same shape as `/leaderboards`, `/workouts`).
- `GET /events/[eventId]/judge-applications` — admin list page (`requireOrganizer`), table of name/email/cell/t-shirt/judged-before/submitted-at for that event.

## Nav

Add "Judge Signups" to `AdminNav.tsx`, pointing at `/judge-applications`. Does not touch the existing "Judges" tab (judge accounts/PIN creation stays as-is).

## Testing

No scoring/ranking logic involved, so no unit-test suite addition — verified with a real insert/select functional check against Supabase (same style as the weekend-pass migration verification), plus typecheck/lint/build.
