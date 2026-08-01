// One-off verification for migration-044 (spectator + vendor tickets).
// NOT YET RUN — migration-044-event-tickets.sql has not been applied to
// the live database (no Supabase CLI/psql access from this environment,
// see docs/plans/2026-08-01-spectator-vendor-tickets-design.md). Apply
// the migration first, then run this the same way verify-m9-rls.mts and
// verify-m039-storage-scoping.mts are run.
//
// Creates two throwaway orgs + organizer/head_judge pairs, an event with
// spectator/vendor pricing in Org A, and a paid test ticket. Confirms:
//   - Org A organizer/head_judge CAN read + write the ticket
//   - Org B organizer/head_judge CANNOT read or write Org A's ticket
//   - anon CANNOT read event_tickets at all (no anon policy exists)
//   - check_in_ticket() RPC atomically increments up to quantity, then
//     reports already_full instead of overshooting
//   - check_in_ticket() RPC refuses a caller from the wrong org
// Cleans up everything it created, pass or fail.
//   npx tsx scripts/verify-m044-event-tickets-rls.mts

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnv(new URL("../.env.local", import.meta.url).pathname);

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const svc = createClient(URL_, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  OK   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? " — " + detail : ""}`);
  }
}

async function makeOrgUser(orgName: string, slug: string, email: string, role: "organizer" | "head_judge", orgId?: string) {
  let org;
  if (orgId) {
    org = { id: orgId };
  } else {
    const { data, error } = await svc
      .from("organizations")
      .upsert({ name: orgName, slug, status: "active" }, { onConflict: "slug" })
      .select()
      .single();
    if (error) throw error;
    org = data;
  }

  const password = `M044test-${Math.random().toString(36).slice(2, 10)}!`;
  const { data: existing } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing.users.find((u) => u.email === email);
  let userId: string;
  if (found) {
    userId = found.id;
    await svc.auth.admin.updateUserById(userId, { password });
  } else {
    const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  }
  await svc.from("profiles").upsert(
    { id: userId, full_name: `${orgName} ${role}`, email, role, organization_id: org.id },
    { onConflict: "id" }
  );
  const client = createClient(URL_, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { org, userId, client };
}

async function main() {
  console.log("Setting up two throwaway orgs + a test event/ticket...");

  const orgAOrganizer = await makeOrgUser("M044 Test Org A", "m044-test-org-a", "m044-test-a-organizer@wodflow.local", "organizer");
  const orgAHeadJudge = await makeOrgUser("M044 Test Org A", "m044-test-org-a", "m044-test-a-hj@wodflow.local", "head_judge", orgAOrganizer.org.id);
  const orgBOrganizer = await makeOrgUser("M044 Test Org B", "m044-test-org-b", "m044-test-b-organizer@wodflow.local", "organizer");

  const { data: event, error: eventErr } = await svc
    .from("events")
    .upsert(
      {
        name: "M044 Test Event",
        slug: "m044-test-event",
        start_date: "2026-09-01",
        status: "published",
        organization_id: orgAOrganizer.org.id,
        spectator_price: 70,
        vendor_price: 500,
      },
      { onConflict: "slug" }
    )
    .select()
    .single();
  if (eventErr) throw eventErr;

  // Simulate a paid purchase directly (the real flow goes through the
  // PayFast webhook — this script is testing RLS/RPC behavior on the
  // row, not the checkout path).
  const { data: ticket, error: ticketErr } = await svc
    .from("event_tickets")
    .insert({
      event_id: event.id,
      ticket_type: "spectator",
      buyer_name: "M044 Test Buyer",
      buyer_email: "m044-test-buyer@wodflow.local",
      quantity: 2,
      unit_price: 70,
      price_paid: 140,
      payment_status: "paid",
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (ticketErr) throw ticketErr;

  console.log("\nRunning checks...\n");

  // 1. Org A organizer can read the ticket.
  const { data: aOrganizerRead, error: aOrganizerReadErr } = await orgAOrganizer.client
    .from("event_tickets")
    .select("id")
    .eq("id", ticket.id);
  check("Org A organizer CAN read the ticket", !aOrganizerReadErr && (aOrganizerRead?.length ?? 0) === 1, aOrganizerReadErr?.message);

  // 2. Org A head_judge can read the ticket (checkin page needs this).
  const { data: aHjRead, error: aHjReadErr } = await orgAHeadJudge.client
    .from("event_tickets")
    .select("id")
    .eq("id", ticket.id);
  check("Org A head_judge CAN read the ticket", !aHjReadErr && (aHjRead?.length ?? 0) === 1, aHjReadErr?.message);

  // 3. Org B organizer CANNOT read Org A's ticket — RLS filters rows
  // rather than erroring, so this must return zero rows, not a thrown error.
  const { data: bOrganizerRead, error: bOrganizerReadErr } = await orgBOrganizer.client
    .from("event_tickets")
    .select("id")
    .eq("id", ticket.id);
  check(
    "Org B organizer CANNOT read Org A's ticket",
    !bOrganizerReadErr && (bOrganizerRead?.length ?? 0) === 0,
    bOrganizerReadErr?.message ?? `expected 0 rows, got ${bOrganizerRead?.length}`
  );

  // 4. anon cannot read event_tickets at all — no anon policy exists.
  const anon = createClient(URL_, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: anonRead, error: anonReadErr } = await anon.from("event_tickets").select("id").eq("id", ticket.id);
  check(
    "anon CANNOT read event_tickets",
    !anonReadErr && (anonRead?.length ?? 0) === 0,
    anonReadErr?.message ?? `expected 0 rows, got ${anonRead?.length}`
  );

  // 5. Org B organizer CANNOT update Org A's ticket directly.
  const { data: bUpdate } = await orgBOrganizer.client
    .from("event_tickets")
    .update({ buyer_name: "should not be applied" })
    .eq("id", ticket.id)
    .select("id");
  check("Org B organizer CANNOT update Org A's ticket", (bUpdate?.length ?? 0) === 0);

  // 6. check_in_ticket RPC: Org B organizer is refused (wrong org) —
  // this is a security definer function, so it must re-implement the
  // authorization check itself rather than relying on RLS.
  const { error: bRpcErr } = await orgBOrganizer.client.rpc("check_in_ticket", { p_ticket_id: ticket.id });
  check("check_in_ticket RPC refuses Org B organizer", !!bRpcErr);

  // 7. check_in_ticket RPC: Org A organizer can check in once (1 of 2).
  const { data: firstCheckin, error: firstCheckinErr } = await orgAOrganizer.client
    .rpc("check_in_ticket", { p_ticket_id: ticket.id })
    .single();
  const first = firstCheckin as { checked_in_count: number; quantity: number; already_full: boolean } | null;
  check(
    "check_in_ticket RPC: first scan increments to 1/2",
    !firstCheckinErr && first?.checked_in_count === 1 && first?.already_full === false,
    firstCheckinErr?.message ?? JSON.stringify(first)
  );

  // 8. Second scan (by head_judge this time) increments to 2/2.
  const { data: secondCheckin, error: secondCheckinErr } = await orgAHeadJudge.client
    .rpc("check_in_ticket", { p_ticket_id: ticket.id })
    .single();
  const second = secondCheckin as { checked_in_count: number; quantity: number; already_full: boolean } | null;
  check(
    "check_in_ticket RPC: second scan (head_judge) increments to 2/2",
    !secondCheckinErr && second?.checked_in_count === 2 && second?.already_full === false,
    secondCheckinErr?.message ?? JSON.stringify(second)
  );

  // 9. Third scan is rejected — already fully used. This is the case
  // that matters most: a single UPDATE statement with the guard in its
  // WHERE clause, so two concurrent scans right at the limit can't both
  // succeed and push the count past quantity.
  const { data: thirdCheckin, error: thirdCheckinErr } = await orgAOrganizer.client
    .rpc("check_in_ticket", { p_ticket_id: ticket.id })
    .single();
  const third = thirdCheckin as { checked_in_count: number; quantity: number; already_full: boolean } | null;
  check(
    "check_in_ticket RPC: third scan reports already_full, count stays at 2",
    !thirdCheckinErr && third?.checked_in_count === 2 && third?.already_full === true,
    thirdCheckinErr?.message ?? JSON.stringify(third)
  );

  console.log(`\n${pass} passed, ${fail} failed.\n`);

  if (process.env.SKIP_CLEANUP) {
    console.log("SKIP_CLEANUP set — leaving test data in place for debugging.");
    console.log(`orgA=${orgAOrganizer.org.id} orgB=${orgBOrganizer.org.id} event=${event.id} ticket=${ticket.id}`);
    process.exit(fail > 0 ? 1 : 0);
  }

  console.log("Cleaning up test data...");
  await svc.from("events").delete().eq("id", event.id); // cascades event_tickets
  for (const email of [
    "m044-test-a-organizer@wodflow.local",
    "m044-test-a-hj@wodflow.local",
    "m044-test-b-organizer@wodflow.local",
  ]) {
    const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = users.users.find((x) => x.email === email);
    if (u) await svc.auth.admin.deleteUser(u.id);
  }
  await svc.from("organizations").delete().in("name", ["M044 Test Org A", "M044 Test Org B"]);
  console.log("Done.");

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
