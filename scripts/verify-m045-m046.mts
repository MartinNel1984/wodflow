// Verification for migration-045 (score value sanity) and
// migration-046 (spectator ticket capacity).
//
// Deliberately attempts the writes each migration is supposed to BLOCK
// and confirms they actually fail — "Success. No rows returned" from the
// SQL editor does not mean a constraint or trigger is really doing its
// job. Cleans up everything it creates, pass or fail.
//   npx tsx scripts/verify-m045-m046.mts

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

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_ID = "fce9ade2-942f-40b9-ac55-cd72df9ce0fe"; // Against The Grain Fitness

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

async function sane(v: unknown): Promise<boolean | null> {
  const { data, error } = await svc.rpc("score_value_is_sane", { v });
  if (error) {
    console.log(`       (rpc error: ${error.message})`);
    return null;
  }
  return data as boolean;
}

async function main() {
  console.log("\n=== migration-045: score_value_is_sane ===\n");

  check("valid finish time accepted", (await sane({ time_seconds: 272 })) === true);
  check("valid capped reps accepted", (await sane({ reps: 142 })) === true);
  check("no_rep accepted", (await sane({ no_rep: true })) === true);

  check("NEGATIVE time rejected (the leaderboard bug)", (await sane({ time_seconds: -500 })) === false);
  check("negative reps rejected", (await sane({ reps: -10 })) === false);
  check("empty object rejected", (await sane({})) === false);
  check("unrecognised key rejected", (await sane({ time_seconds: 1, injected: "x" })) === false);
  check("string-typed time rejected", (await sane({ time_seconds: "272" })) === false);
  check("absurd time rejected", (await sane({ time_seconds: 999999999 })) === false);
  check("measures-nothing rejected", (await sane({ no_rep: false })) === false);

  // Now prove the CONSTRAINT is actually attached to the table, not just
  // that the helper function exists — insert against a real heat
  // assignment and confirm the DB refuses it.
  console.log("\n=== migration-045: constraint is live on public.scores ===\n");
  const { data: anyAssignment } = await svc.from("heat_assignments").select("id").limit(1).maybeSingle();
  if (!anyAssignment) {
    console.log("  SKIP no heat_assignments exist to test a real insert against");
  } else {
    const { error: badErr } = await svc.from("scores").insert({
      heat_assignment_id: anyAssignment.id,
      workout_id: "m045-verify",
      value_raw: { time_seconds: -500 },
      client_submission_id: crypto.randomUUID(),
    });
    check(
      "real INSERT of negative time is refused by the DB",
      !!badErr && /scores_value_raw_sane|violates check constraint/i.test(badErr.message),
      badErr ? badErr.message : "insert unexpectedly succeeded"
    );

    // If it wrongly succeeded, clean it up so we don't poison the leaderboard.
    if (!badErr) {
      await svc.from("scores").delete().eq("workout_id", "m045-verify");
    }
  }

  console.log("\n=== migration-045: existing rows are all clean ===\n");
  const { data: existing, error: existErr } = await svc
    .from("scores")
    .select("id, value_raw, tiebreak_value")
    .limit(1000);
  if (existErr) {
    check("could read existing scores", false, existErr.message);
  } else {
    const bad: string[] = [];
    for (const row of existing ?? []) {
      const vOk = await sane(row.value_raw);
      const tOk = row.tiebreak_value == null ? true : await sane(row.tiebreak_value);
      if (vOk === false || tOk === false) bad.push(row.id);
    }
    check(
      `all ${existing?.length ?? 0} existing score rows satisfy the new constraint`,
      bad.length === 0,
      bad.length ? `offending ids: ${bad.join(", ")}` : undefined
    );
  }

  console.log("\n=== migration-046: spectator capacity trigger ===\n");
  const { data: event, error: evErr } = await svc
    .from("events")
    .upsert(
      {
        name: "M046 Capacity Test",
        slug: "m046-capacity-test",
        start_date: "2026-12-20",
        status: "published",
        organization_id: ORG_ID,
        spectator_price: 50,
        spectator_capacity: 10,
      },
      { onConflict: "slug" }
    )
    .select()
    .single();
  if (evErr || !event) {
    check("could create test event", false, evErr?.message);
    return finish();
  }
  check("spectator_capacity column accepted a value", event.spectator_capacity === 10);
  check("max_tickets_per_order defaulted to 20", event.max_tickets_per_order === 20);

  const buy = (quantity: number) =>
    svc
      .from("event_tickets")
      .insert({
        event_id: event.id,
        ticket_type: "spectator",
        buyer_name: "M046 Test",
        buyer_email: "m046@wodflow.local",
        quantity,
        unit_price: 50,
        price_paid: 50 * quantity,
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

  const { error: e1 } = await buy(6);
  check("first purchase of 6 (of 10) succeeds", !e1, e1?.message);

  const { error: e2 } = await buy(6);
  check(
    "second purchase of 6 is BLOCKED (would total 12 > 10)",
    !!e2 && /spectator ticket/i.test(e2.message),
    e2 ? e2.message : "oversell was allowed"
  );

  const { error: e3 } = await buy(4);
  check("purchase of exactly the remaining 4 succeeds", !e3, e3?.message);

  const { error: e4 } = await buy(1);
  check(
    "further purchase once full is BLOCKED",
    !!e4 && /spectator ticket/i.test(e4.message),
    e4 ? e4.message : "oversell was allowed"
  );

  // Per-order cap, independent of capacity.
  await svc.from("events").update({ spectator_capacity: null }).eq("id", event.id);
  const { error: e5 } = await buy(21);
  check(
    "order of 21 is BLOCKED by max_tickets_per_order (20)",
    !!e5 && /per order/i.test(e5.message),
    e5 ? e5.message : "oversized order was allowed"
  );
  const { error: e6 } = await buy(20);
  check("order of exactly 20 succeeds when capacity is unlimited", !e6, e6?.message);

  // Refunds should free seats back up.
  await svc.from("events").update({ spectator_capacity: 10 }).eq("id", event.id);
  await svc.from("event_tickets").update({ payment_status: "refunded" }).eq("event_id", event.id);
  const { error: e7 } = await buy(10);
  check("refunded purchases release their seats", !e7, e7?.message);

  console.log("\nCleaning up test data...");
  await svc.from("events").delete().eq("id", event.id); // cascades event_tickets
  console.log("Done.");

  finish();
}

function finish() {
  console.log(`\n${pass} passed, ${fail} failed.\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
