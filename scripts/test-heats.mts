// One-off verification: hand-worked edge cases for lib/heats.ts,
// exercised against the real pure function via tsx (no test framework
// wired up yet for a single-file check — add vitest properly if this
// module grows more cases). Run: npx tsx scripts/test-heats.mts
import { generateHeats, type RosterEntry } from "../lib/heats";

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

// --- Case 1: even split, no seeding (workout 1 scenario) ---
{
  const roster: RosterEntry[] = Array.from({ length: 12 }, (_, i) => ({
    registrationId: `r${i}`,
    registrationOrder: i,
    seedRank: null,
  }));
  const result = generateHeats({
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
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 1).map((a) => a.registrationId),
    ["r0", "r1", "r2", "r3", "r4", "r5"],
    "even split: heat 1 gets first 6 in registration order"
  );
}

// --- Case 2: odd roster size, uneven lane count (23 athletes / 6 lanes) ---
{
  const roster: RosterEntry[] = Array.from({ length: 23 }, (_, i) => ({
    registrationId: `r${i}`,
    registrationOrder: i,
    seedRank: null,
  }));
  const result = generateHeats({
    laneCount: 6,
    heatDurationMinutes: 6,
    transitionMinutes: 2,
    startTime: start,
    roster,
  });
  assertEqual(result.heats.length, 4, "odd roster: 23 athletes / 6 lanes -> 4 heats (ceil)");
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 4).length,
    5,
    "odd roster: last heat gets the remaining 5, not padded to 6"
  );
}

// --- Case 3: empty division ---
{
  const result = generateHeats({
    laneCount: 6,
    heatDurationMinutes: 6,
    transitionMinutes: 2,
    startTime: start,
    roster: [],
  });
  assertEqual(result.heats.length, 0, "empty division: zero heats generated, no crash");
  assertEqual(result.assignments.length, 0, "empty division: zero assignments");
}

// --- Case 4: re-seeding between rounds — best seed lands in final heat ---
{
  const roster: RosterEntry[] = [
    { registrationId: "worst", registrationOrder: 0, seedRank: 6 },
    { registrationId: "best", registrationOrder: 1, seedRank: 1 },
    { registrationId: "mid", registrationOrder: 2, seedRank: 3 },
  ];
  const result = generateHeats({
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
  const result = generateHeats({
    laneCount: 2,
    heatDurationMinutes: 6,
    transitionMinutes: 2,
    startTime: start,
    roster,
  });
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 1).map((a) => a.registrationId),
    ["unseeded-a", "unseeded-b"],
    "mixed: unseeded athletes fill heat 1"
  );
  assertEqual(
    result.assignments.filter((a) => a.heatNumber === 2).map((a) => a.registrationId),
    ["seeded-worst", "seeded-best"],
    "mixed: seeded athletes fill heat 2, worst-seed-first within it"
  );
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("\nAll heat-generation edge cases passed.");
