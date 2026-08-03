// One-off verification: hand-worked edge cases for the configurable
// scoring formulas + tiebreak resolution in lib/leaderboard.ts.
// Run: npx tsx scripts/test-scoring-formulas.mts
import { computeWorkoutResults, type LeaderboardRow } from "../lib/leaderboard";

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

function row(regId: string, time: number, tiebreak?: number): LeaderboardRow {
  return {
    heat_assignment_id: regId,
    workout_id: "wod1",
    value_raw: { time_seconds: time },
    tiebreak_value: tiebreak != null ? { time_seconds: tiebreak } : null,
    registration_id: regId,
    display_name: regId,
  };
}

// --- rank_sum (default, unchanged behavior) ---
{
  const rows = [row("a", 100), row("b", 90), row("c", 110)];
  const results = computeWorkoutResults(rows, ["a", "b", "c"], { method: "rank_sum" });
  assertEqual(
    results.map((r) => [r.registrationId, r.position, r.points]),
    [
      ["b", 1, 3],
      ["a", 2, 2],
      ["c", 3, 1],
    ],
    "rank_sum: 3 entrants -> points 3,2,1"
  );
}

// --- gap_formula: 12-participant example (winner 100, gap = round(100/11) = 9) ---
{
  const rows = Array.from({ length: 12 }, (_, i) => row(`r${i}`, 100 + i)); // r0 fastest
  const results = computeWorkoutResults(rows, rows.map((r) => r.registration_id), {
    method: "gap_formula",
  });
  assertEqual(results[0].points, 100, "gap_formula: winner gets 100");
  assertEqual(results[1].points, 91, "gap_formula: 2nd loses one gap (9) -> 91");
  assertEqual(results[2].points, 82, "gap_formula: 3rd -> 82");
  // Gap is derived as round(winner_points / (entrants - 1)) — dividing
  // by the number of GAPS between 1st and last, not the entrant count —
  // so last place always lands at (or near) 0 regardless of field size.
  // Fixed 2026-08-03: dividing by entrants instead used to overshoot on
  // large fields (round-up on the gap hit 0 many places before last).
  assertEqual(results[11].points, 1, "gap_formula: 12th (last) place lands at 1 (100 - 11*9)");
}

// --- gap_formula: custom winner_points ---
{
  const rows = [row("a", 100), row("b", 110)];
  const results = computeWorkoutResults(rows, ["a", "b"], { method: "gap_formula", winner_points: 50 });
  // 2 entrants -> 1 gap -> gap = round(50/1) = 50 -> winner 50, last exactly 0.
  assertEqual(results.map((r) => r.points), [50, 0], "gap_formula: winner_points=50, 2 entrants -> gap 50 -> 50,0");
}

// --- gap_formula: points never go negative ---
{
  const rows = Array.from({ length: 3 }, (_, i) => row(`r${i}`, 100 + i));
  const results = computeWorkoutResults(rows, rows.map((r) => r.registration_id), {
    method: "gap_formula",
    winner_points: 10,
  });
  // winner_points=10, 3 entrants -> gap = round(10/2) = 5 -> 10, 5, 0
  assertEqual(results.map((r) => r.points), [10, 5, 0], "gap_formula: small winner_points still floors correctly");
}

// --- tiebreak resolution: same primary time, tiebreak breaks it ---
{
  const rows = [row("a", 100, 50), row("b", 100, 45)];
  const results = computeWorkoutResults(rows, ["a", "b"], { method: "rank_sum" });
  assertEqual(
    results.map((r) => r.registrationId),
    ["b", "a"],
    "tiebreak: equal primary time, lower tiebreak time wins (b's 45 beats a's 50)"
  );
}

// --- no tiebreak recorded on either side: stable order, no crash ---
{
  const rows = [row("a", 100), row("b", 100)];
  const results = computeWorkoutResults(rows, ["a", "b"], { method: "rank_sum" });
  assertEqual(results.length, 2, "no tiebreak recorded: still produces 2 ranked results without erroring");
}

console.log(failures === 0 ? "\nAll scoring formula checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures > 0 ? 1 : 0);
