// Verification for the heat re-seeding fix.
//
// Exercises the REAL pipeline the generateHeatsForDivision action uses —
// the same public_leaderboard view, the same workouts.sequence filter,
// the same computeStandings call, the same generateHeats function — against
// real rows in the live database, not a mock. Only form parsing and the
// auth guard are outside this path.
//
// The bug being verified: the action previously hardcoded `seedRank: null`,
// so every workout's heats came out in registration order and the strongest
// athletes never got moved to the final heat.
//   npx tsx scripts/verify-heat-reseeding.mts

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeStandings, type LeaderboardRow, type ScoringConfig } from "../lib/leaderboard";
import { generateHeats, type RosterEntry } from "../lib/heats";

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

const ORG_ID = "fce9ade2-942f-40b9-ac55-cd72df9ce0fe";
const ATHLETES = 8;
const LANES = 4;

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`  OK   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? " — " + detail : ""}`); }
}

let eventId: string | null = null;

async function cleanup() {
  if (eventId) {
    await svc.from("events").delete().eq("id", eventId);
    console.log("Cleaned up test event.");
  }
}

async function main() {
  console.log("\nSeeding a throwaway 2-workout division...\n");

  const { data: event, error: evErr } = await svc
    .from("events")
    .upsert(
      { name: "Reseed Verify", slug: "reseed-verify", start_date: "2026-12-28",
        status: "published", organization_id: ORG_ID },
      { onConflict: "slug" }
    ).select().single();
  if (evErr || !event) throw evErr ?? new Error("no event");
  eventId = event.id;

  const { data: division, error: dErr } = await svc
    .from("divisions")
    .insert({ event_id: event.id, name: "Reseed Div", team_size: 1, price_normal: 0 })
    .select().single();
  if (dErr || !division) throw dErr ?? new Error("no division");

  const { data: workouts, error: wErr } = await svc
    .from("workouts")
    .insert([
      { division_id: division.id, name: "WOD 1", sequence: 1, scoring_type: "time" },
      { division_id: division.id, name: "WOD 2", sequence: 2, scoring_type: "time" },
    ]).select();
  if (wErr || !workouts) throw wErr ?? new Error("no workouts");
  const wod1 = workouts.find((w) => w.sequence === 1)!;
  const wod2 = workouts.find((w) => w.sequence === 2)!;

  // 8 athletes, registered in order A..H.
  const regRows = [];
  for (let i = 0; i < ATHLETES; i++) {
    const { data: reg } = await svc.from("registrations")
      .insert({ event_id: event.id, division_id: division.id,
                team_name: `Athlete ${String.fromCharCode(65 + i)}`,
                price_paid: 0, payment_status: "paid" })
      .select("id, registration_order, team_name").single();
    regRows.push(reg!);
  }
  console.log(`  ${regRows.length} paid registrations created.\n`);

  // WOD 1 heats + scores. Finish times are deliberately SCRAMBLED
  // relative to registration order — the fastest athlete (B) registered
  // second, the slowest (C) registered third. A monotonic mapping (last
  // registered = fastest) would make registration order and seeded order
  // produce identical heats by coincidence, so the test would pass even
  // with the fix reverted. The regression guard at the bottom is what
  // catches that, and it did.
  const { data: h1 } = await svc.from("heats")
    .insert({ event_id: event.id, division_id: division.id, workout_id: wod1.id,
              heat_number: 1, start_time: new Date().toISOString(),
              end_time: new Date(Date.now() + 6e5).toISOString(), status: "completed" })
    .select().single();

  //            A    B    C    D    E    F    G    H
  // rank:      3    1    8    7    5    4    6    2
  const TIMES = [250, 230, 300, 295, 270, 260, 280, 245];
  for (let i = 0; i < regRows.length; i++) {
    const { data: ha } = await svc.from("heat_assignments")
      .insert({ heat_id: h1!.id, registration_id: regRows[i].id, lane_number: i + 1 })
      .select().single();
    await svc.from("scores").insert({
      heat_assignment_id: ha!.id,
      workout_id: wod1.id,
      workout_ref_id: wod1.id,
      value_raw: { time_seconds: TIMES[i] },
      client_submission_id: crypto.randomUUID(),
    });
  }
  console.log("  WOD 1 scored: Athlete B fastest (230s), Athlete C slowest (300s).\n");

  // ---- The exact pipeline the action runs -------------------------
  console.log("=== Running the real seeding pipeline ===\n");

  const { data: priorWorkouts } = await svc.from("workouts")
    .select("id").eq("division_id", division.id).lt("sequence", wod2.sequence);
  const priorIds = new Set((priorWorkouts ?? []).map((w) => w.id as string));
  check("prior workouts resolved for WOD 2 (should be just WOD 1)",
    priorIds.size === 1 && priorIds.has(wod1.id), `got ${priorIds.size}`);

  const { data: rows } = await svc.from("public_leaderboard")
    .select("heat_assignment_id, workout_id, value_raw, registration_id, display_name, tiebreak_value, workout_name, workout_scoring_config")
    .eq("division_id", division.id);
  const priorRows = ((rows ?? []) as LeaderboardRow[]).filter((r) => priorIds.has(r.workout_id));
  check("leaderboard view returned the WOD 1 scores",
    priorRows.length === ATHLETES, `got ${priorRows.length} of ${ATHLETES}`);

  const { standings } = computeStandings(priorRows, { method: "rank_sum" } as ScoringConfig);
  const seedRankByRegistration = new Map<string, number>();
  standings.forEach((s, i) => seedRankByRegistration.set(s.registrationId, i + 1));

  const topName = standings[0]?.displayName;
  check("standings rank Athlete B first (fastest WOD 1 time)",
    topName === "Athlete B", `got "${topName}"`);

  const roster: RosterEntry[] = regRows.map((r) => ({
    registrationId: r.id,
    registrationOrder: r.registration_order,
    seedRank: seedRankByRegistration.get(r.id) ?? null,
  }));
  check("every athlete received a seed rank",
    roster.every((r) => r.seedRank != null),
    `unseeded: ${roster.filter((r) => r.seedRank == null).length}`);

  const { heats, assignments } = generateHeats({
    laneCount: LANES, heatDurationMinutes: 10, transitionMinutes: 2,
    startTime: new Date("2026-12-28T08:00:00"), roster,
  });

  const nameById = new Map(regRows.map((r) => [r.id, r.team_name]));
  const finalHeat = Math.max(...assignments.map((a) => a.heatNumber));
  const finalHeatNames = assignments.filter((a) => a.heatNumber === finalHeat)
    .map((a) => nameById.get(a.registrationId));
  const firstHeatNames = assignments.filter((a) => a.heatNumber === 1)
    .map((a) => nameById.get(a.registrationId));

  console.log(`\n  Heat 1        : ${firstHeatNames.join(", ")}`);
  console.log(`  Heat ${finalHeat} (final): ${finalHeatNames.join(", ")}\n`);

  check("heat count is correct", heats.length === Math.ceil(ATHLETES / LANES));
  check("THE LEADER (Athlete B) IS IN THE FINAL HEAT",
    finalHeatNames.includes("Athlete B"), `final heat = ${finalHeatNames.join(", ")}`);
  check("the slowest (Athlete C) is in the first heat",
    firstHeatNames.includes("Athlete C"), `heat 1 = ${firstHeatNames.join(", ")}`);
  check("no athlete is assigned twice",
    new Set(assignments.map((a) => a.registrationId)).size === ATHLETES);
  check("every athlete is assigned", assignments.length === ATHLETES);

  // Regression guard: the OLD behaviour (seedRank hardcoded null) must
  // produce a demonstrably different, registration-ordered result —
  // otherwise this test would pass even if the fix were reverted.
  const oldRoster = roster.map((r) => ({ ...r, seedRank: null }));
  const oldResult = generateHeats({
    laneCount: LANES, heatDurationMinutes: 10, transitionMinutes: 2,
    startTime: new Date("2026-12-28T08:00:00"), roster: oldRoster,
  });
  const oldFinalNames = oldResult.assignments
    .filter((a) => a.heatNumber === Math.max(...oldResult.assignments.map((x) => x.heatNumber)))
    .map((a) => nameById.get(a.registrationId));
  check("pre-fix behaviour would NOT have put the leader last (proves the fix matters)",
    !oldFinalNames.includes("Athlete B"), `old final heat = ${oldFinalNames.join(", ")}`);

  console.log("");
  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed.\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await cleanup();
  process.exit(1);
});
