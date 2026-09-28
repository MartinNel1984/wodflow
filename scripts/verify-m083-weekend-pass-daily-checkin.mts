// Verification for migration-083 (weekend passes check in once per day).
// Run after the migration is applied:
//   npx tsx scripts/verify-m083-weekend-pass-daily-checkin.mts
//
// Creates a throwaway org + organizer, an event, one paid weekend pass
// (x2) and one paid day pass (x1). Confirms:
//   - weekend pass: 2 scans today succeed, 3rd reports already_full
//   - after moving today's row to yesterday (simulating day 1 being
//     over), the same weekend pass checks in again today
//   - ticket_checked_in_now() reports today's count, not the lifetime one
//   - day pass: 1 scan succeeds, 2nd is refused and stays refused (the
//     lifetime gate is unchanged)
//   - ticket_daily_checkins is not readable or writable by anon, and not
//     directly writable by the organizer (only via the RPC)
// Cleans up everything it created, pass or fail.

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
const anon = createClient(URL_, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const ORG_NAME = "M083 Test Org";
const EMAIL = "m083-test-organizer@wodflow.local";

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

type CheckinRow = { checked_in_count: number; quantity: number; already_full: boolean };

function johannesburgDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(d);
}

async function main() {
  console.log("Setting up a throwaway org, event and tickets...");

  const { data: org, error: orgErr } = await svc
    .from("organizations")
    .upsert({ name: ORG_NAME, slug: "m083-test-org", status: "active" }, { onConflict: "slug" })
    .select()
    .single();
  if (orgErr) throw orgErr;

  const password = `M083test-${Math.random().toString(36).slice(2, 10)}!`;
  const { data: existing } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing.users.find((u) => u.email === EMAIL);
  let userId: string;
  if (found) {
    userId = found.id;
    await svc.auth.admin.updateUserById(userId, { password });
  } else {
    const { data, error } = await svc.auth.admin.createUser({ email: EMAIL, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  }
  await svc
    .from("profiles")
    .upsert(
      { id: userId, full_name: "M083 organizer", email: EMAIL, role: "organizer", organization_id: org.id },
      { onConflict: "id" }
    );
  const organizer = createClient(URL_, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await organizer.auth.signInWithPassword({ email: EMAIL, password });
  if (signInError) throw signInError;

  const { data: event, error: eventErr } = await svc
    .from("events")
    .upsert(
      {
        name: "M083 Test Event",
        slug: "m083-test-event",
        start_date: johannesburgDate(-1),
        end_date: johannesburgDate(1),
        status: "published",
        organization_id: org.id,
        spectator_price: 70,
        weekend_pass_price: 150,
      },
      { onConflict: "slug" }
    )
    .select()
    .single();
  if (eventErr) throw eventErr;

  const { data: tickets, error: ticketErr } = await svc
    .from("event_tickets")
    .insert([
      {
        event_id: event.id,
        ticket_type: "weekend_pass",
        buyer_name: "M083 Weekend Buyer",
        buyer_email: "m083-weekend@wodflow.local",
        quantity: 2,
        unit_price: 150,
        price_paid: 300,
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      },
      {
        event_id: event.id,
        ticket_type: "spectator",
        buyer_name: "M083 Day Buyer",
        buyer_email: "m083-day@wodflow.local",
        quantity: 1,
        unit_price: 70,
        price_paid: 70,
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      },
    ])
    .select();
  if (ticketErr) throw ticketErr;
  const weekend = tickets.find((t) => t.ticket_type === "weekend_pass")!;
  const day = tickets.find((t) => t.ticket_type === "spectator")!;

  const scan = async (ticketId: string) => {
    const { data, error } = await organizer.rpc("check_in_ticket", { p_ticket_id: ticketId }).single();
    return { row: data as CheckinRow | null, error };
  };
  const nowCount = async (ticketId: string) => {
    const { data, error } = await organizer.rpc("ticket_checked_in_now", { p_ticket_id: ticketId });
    return error ? `error: ${error.message}` : (data as number);
  };

  try {
    console.log("\nDay 1 (weekend pass x2):");
    let r = await scan(weekend.id);
    check("scan 1 → 1/2", !r.error && r.row?.checked_in_count === 1 && !r.row.already_full, JSON.stringify(r));
    r = await scan(weekend.id);
    check("scan 2 → 2/2", !r.error && r.row?.checked_in_count === 2 && !r.row.already_full, JSON.stringify(r));
    r = await scan(weekend.id);
    check("scan 3 → already_full", !r.error && r.row?.checked_in_count === 2 && r.row.already_full, JSON.stringify(r));
    check("ticket_checked_in_now = 2", (await nowCount(weekend.id)) === 2);

    // Simulate day 1 being over: move today's row to yesterday.
    const { error: moveErr } = await svc
      .from("ticket_daily_checkins")
      .update({ checkin_date: johannesburgDate(-1) })
      .eq("ticket_id", weekend.id)
      .eq("checkin_date", johannesburgDate(0));
    if (moveErr) throw moveErr;

    console.log("\nDay 2 (same weekend pass):");
    check("ticket_checked_in_now = 0 on a new day", (await nowCount(weekend.id)) === 0);
    r = await scan(weekend.id);
    check("scan 1 → 1/2 (re-entry allowed)", !r.error && r.row?.checked_in_count === 1 && !r.row.already_full, JSON.stringify(r));
    r = await scan(weekend.id);
    check("scan 2 → 2/2", !r.error && r.row?.checked_in_count === 2 && !r.row.already_full, JSON.stringify(r));
    r = await scan(weekend.id);
    check("scan 3 → already_full", !r.error && r.row?.already_full === true, JSON.stringify(r));

    const { data: days } = await svc
      .from("ticket_daily_checkins")
      .select("checkin_date, checked_in_count")
      .eq("ticket_id", weekend.id)
      .order("checkin_date");
    check(
      "two separate day rows, 2 each",
      days?.length === 2 && days.every((d) => d.checked_in_count === 2),
      JSON.stringify(days)
    );
    const { data: wt } = await svc.from("event_tickets").select("checked_in_count").eq("id", weekend.id).single();
    check("lifetime total = 4", wt?.checked_in_count === 4, JSON.stringify(wt));

    console.log("\nDay pass x1 (unchanged behaviour):");
    r = await scan(day.id);
    check("scan 1 → 1/1", !r.error && r.row?.checked_in_count === 1 && !r.row.already_full, JSON.stringify(r));
    r = await scan(day.id);
    check("scan 2 → already_full", !r.error && r.row?.already_full === true, JSON.stringify(r));
    check("ticket_checked_in_now = 1 (lifetime)", (await nowCount(day.id)) === 1);

    console.log("\nAccess:");
    const { data: anonRows, error: anonErr } = await anon.from("ticket_daily_checkins").select("*");
    check("anon can't read ticket_daily_checkins", !!anonErr || (anonRows?.length ?? 0) === 0, JSON.stringify(anonRows));
    const { data: orgRows } = await organizer.from("ticket_daily_checkins").select("*").eq("ticket_id", weekend.id);
    check("organizer can read own org's rows", orgRows?.length === 2, JSON.stringify(orgRows));
    const { error: directErr } = await organizer
      .from("ticket_daily_checkins")
      .update({ checked_in_count: 0 })
      .eq("ticket_id", weekend.id)
      .select();
    const { data: after } = await svc
      .from("ticket_daily_checkins")
      .select("checked_in_count")
      .eq("ticket_id", weekend.id);
    check(
      "organizer can't reset counts directly",
      !!directErr || (after ?? []).every((d) => d.checked_in_count === 2),
      JSON.stringify(after)
    );
  } finally {
    console.log(`\n${pass} passed, ${fail} failed.\n`);
    console.log("Cleaning up test data...");
    await svc.from("events").delete().eq("id", event.id); // cascades tickets + daily rows
    await svc.auth.admin.deleteUser(userId);
    await svc.from("organizations").delete().eq("id", org.id);
    console.log("Done.");
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
