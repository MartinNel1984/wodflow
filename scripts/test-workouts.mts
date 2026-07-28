// One-off verification: hand-worked edge cases for lib/workouts.ts.
// Run: node scripts/test-workouts.mts
import { cumulativeReference, type Movement } from "../lib/workouts";

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

// --- Case 1: "Love 8 Relationship" shape — 3 movements, 8 rounds
// (3 muscle-ups, 5 HSPU, 8 hang squat cleans -> 16/round, 128 total).
// Cross-checked against the real scoresheet's end-of-round totals
// (/16, /32, ... /128), which line up exactly even though the paper
// sheet shows extra mid-movement checkpoints this simplified model
// doesn't attempt to reproduce (see lib/workouts.ts comment).
{
  const movements: Movement[] = [
    { id: "mu", sequence: 1, name: "3 Bar Muscle-ups", reps: 3, rounds: 8 },
    { id: "hspu", sequence: 2, name: "5 HSPU", reps: 5, rounds: 8 },
    { id: "cleans", sequence: 3, name: "8 DB Hang Squat Cleans", reps: 8, rounds: 8 },
  ];
  const result = cumulativeReference(movements);
  assertEqual(result.length, 8, "8 rounds computed");
  assertEqual(
    result[0].cells.map((c) => c.cumulative),
    [3, 8, 16],
    "round 1 cumulative: 3, 8, 16"
  );
  assertEqual(
    result[7].cells.map((c) => c.cumulative),
    [115, 120, 128],
    "round 8 cumulative ends at 128 (8 x 16)"
  );
}

// --- Case 2: single movement, single round ---
{
  const movements: Movement[] = [
    { id: "m1", sequence: 1, name: "Row 500m", reps: null, rounds: 1 },
  ];
  const result = cumulativeReference(movements);
  assertEqual(result.length, 1, "single-round workout produces one row");
  assertEqual(result[0].cells[0].cumulative, null, "no rep count -> null, not 0 (e.g. a pure-time movement)");
}

// --- Case 3: empty workout (no movements added yet) ---
{
  assertEqual(cumulativeReference([]), [], "no movements -> empty grid, not a crash");
}

console.log(failures === 0 ? "\nAll workout reference checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures > 0 ? 1 : 0);
