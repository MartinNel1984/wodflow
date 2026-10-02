// One-off verification: hand-worked edge cases for lib/heats.ts,
// exercised against the real pure functions via tsx (no test framework
// wired up yet for a single-file check — add vitest properly if this
// module grows more cases). Run: npx tsx scripts/test-heats.mts
import { buildHeatSchedule, assignRosterToHeats, type RosterEntry } from "../lib/heats";

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  actual:   ${a}\n  expected: ${e}`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const start = new Date("2026-08-01T08:00:00Z");

function generate(params: {
  laneCount: number;
  heatDurationMinutes: number;
  transitionMinutes: number;
  startTime: Date;
  roster: RosterEntry[];
}) {
  const heats = buildHeatSchedule({
    laneCount: params.laneCount,
    heatDurationMinutes: params.heatDurationMinutes,
    transitionMinutes: params.transitionMinutes,
    startTime: params.startTime,
    rosterSize: params.roster.length,
  });
  const assignments = assignRosterToHeats({
    laneCount: params.laneCount,
    roster: params.roster,
    heatNumbers: heats.map((h) => h.heatNumber),
  });
  return { heats, assignments };
}

// --- Case 1: even split, no seeding (workout 1 scenario) ---
{
  const roster: RosterEntry[] = Array.from({ length: 12 }, (_, i) => ({
    registrationId: `r${i}`,
    registrationOrder: i,
    seedRank: null,
  }));
  const result = generate({
    laneCount: 6,
    heatDurationMinutes: 6,
    transitionMinutes: 2,
    startTime: start,
    roster,
  });
  assertEqual(result.heats.length, 2, "even split: 12 athletes / 6 lanes -> 2 heats");
  assertEqual(
    result.heats.map((h) => h.startTime.toISOString()),
    ["2026-08-01T08:00:00.000Z", "2026-08-01T08:08:00.000Z"],
    "even split: heat start times back-to-back (6+2 min slots)"
  );
  // Centre-out lanes (Tjokkie, 2026-10-02): within each heat the slice is
  // reversed and then placed middle-outward. For 6 lanes that is
  // positions 0..5 -> lanes 3,4,2,5,1,6. The six-athlete slice [r0..r5]
  // reversed is [r5..r0], giving (array order) r5,r4,r3,r2,r1,r0.
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 1).map((a) => a.registrationId),
    ["r5", "r4", "r3", "r2", "r1", "r0"],
    "even split: heat 1 has the first 6 regs under centre-out lane order"
  );
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 1).map((a) => a.laneNumber),
    [3, 4, 2, 5, 1, 6],
    "even split: heat 1 lanes follow centre-out pattern 3,4,2,5,1,6"
  );
}

// --- Case 2: odd roster size, uneven lane count (23 athletes / 6 lanes) ---
{
  const roster: RosterEntry[] = Array.from({ length: 23 }, (_, i) => ({
    registrationId: `r${i}`,
    registrationOrder: i,
    seedRank: null,
  }));
  const result = generate({
    laneCount: 6,
    heatDurationMinutes: 6,
    transitionMinutes: 2,
    startTime: start,
    roster,
  });
  assertEqual(result.heats.length, 4, "odd roster: 23 athletes / 6 lanes -> 4 heats (ceil)");
  // Flipped 2026-08-13 (Tjokkie): the leftover/partial group now lands
  // in Heat 1, not the final heat — asserting the reverse of what this
  // case checked before the fix, so a regression back to the old
  // behavior would fail loudly here.
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 1).length,
    5,
    "odd roster: heat 1 gets the leftover 5, not padded to 6"
  );
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 4).length,
    6,
    "odd roster: last heat is full (6), not the partial one"
  );
}

// --- Case 3: empty division ---
{
  let threw = false;
  try {
    buildHeatSchedule({
      laneCount: 6,
      heatDurationMinutes: 6,
      transitionMinutes: 2,
      startTime: start,
      rosterSize: 0,
    });
  } catch {
    threw = true;
  }
  assertEqual(threw, true, "empty division: buildHeatSchedule throws rather than silently no-op");
}

// --- Case 4: re-seeding between rounds — best seed lands in final heat ---
{
  const roster: RosterEntry[] = [
    { registrationId: "worst", registrationOrder: 0, seedRank: 6 },
    { registrationId: "best", registrationOrder: 1, seedRank: 1 },
    { registrationId: "mid", registrationOrder: 2, seedRank: 3 },
  ];
  const result = generate({
    laneCount: 2,
    heatDurationMinutes: 6,
    transitionMinutes: 2,
    startTime: start,
    roster,
  });
  const finalHeatNumber = result.heats[result.heats.length - 1].heatNumber;
  const finalHeatAthletes = result.assignments
    .filter((a) => a.heatNumber === finalHeatNumber)
    .map((a) => a.registrationId);
  assertEqual(
    finalHeatAthletes.includes("best"),
    true,
    "re-seed: rank-1 (best) seed lands in the final heat"
  );
}

// --- Case 5: unseeded athletes fill earliest heats, seeded fill the rest ---
{
  const roster: RosterEntry[] = [
    { registrationId: "unseeded-a", registrationOrder: 0, seedRank: null },
    { registrationId: "unseeded-b", registrationOrder: 1, seedRank: null },
    { registrationId: "seeded-worst", registrationOrder: 2, seedRank: 2 },
    { registrationId: "seeded-best", registrationOrder: 3, seedRank: 1 },
  ];
  const result = generate({
    laneCount: 2,
    heatDurationMinutes: 6,
    transitionMinutes: 2,
    startTime: start,
    roster,
  });
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 1).map((a) => a.registrationId),
    ["unseeded-b", "unseeded-a"],
    "mixed: unseeded athletes fill heat 1 (reversed for centre-out)"
  );
  // Centre-out puts best-seeded at the middle lane. For 2 lanes mid=0,
  // so best gets lane 1 and worst gets lane 2 — array order reflects
  // that reversal.
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 2).map((a) => a.registrationId),
    ["seeded-best", "seeded-worst"],
    "mixed: seeded athletes fill heat 2, best-seed at centre lane"
  );
}

// --- Case 7: centre-out lane assignment (Tjokkie, 2026-10-02) ---
{
  const roster: RosterEntry[] = Array.from({ length: 10 }, (_, i) => ({
    registrationId: `rank${i + 1}`,
    registrationOrder: i,
    seedRank: i + 1,
  }));
  const result = generate({
    laneCount: 10,
    heatDurationMinutes: 6,
    transitionMinutes: 2,
    startTime: start,
    roster,
  });
  const laneByRank: Record<string, number> = {};
  for (const a of result.assignments) laneByRank[a.registrationId] = a.laneNumber;
  assertEqual(laneByRank["rank1"], 5, "centre-out: best seed goes to lane 5 of 10");
  assertEqual(laneByRank["rank2"], 6, "centre-out: 2nd goes to lane 6");
  assertEqual(laneByRank["rank3"], 4, "centre-out: 3rd goes to lane 4");
  assertEqual(laneByRank["rank9"], 1, "centre-out: 9th goes to lane 1");
  assertEqual(laneByRank["rank10"], 10, "centre-out: 10th (worst) goes to lane 10");
}

// --- Case 6: assignRosterToHeats rejects a roster too big for the schedule ---
{
  const roster: RosterEntry[] = Array.from({ length: 7 }, (_, i) => ({
    registrationId: `r${i}`,
    registrationOrder: i,
    seedRank: null,
  }));
  let threw = false;
  try {
    assignRosterToHeats({ laneCount: 6, roster, heatNumbers: [1] });
  } catch {
    threw = true;
  }
  assertEqual(threw, true, "over-capacity roster: assignRosterToHeats throws instead of silently dropping athletes");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("\nAll heat-generation edge cases passed.");
