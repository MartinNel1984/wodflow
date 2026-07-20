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

// --- gap_formula: Tjokkie's 12-participant example (winner 100, gap 8) ---
{
  const rows = Array.from({ length: 12 }, (_, i) => row(`r${i}`, 100 + i)); // r0 fastest
  const results = computeWorkoutResults(rows, rows.map((r) => r.registration_id), {
    method: "gap_formula",
  });
  assertEqual(results[0].points, 100, "gap_formula: winner gets 100");
  assertEqual(results[1].points, 92, "gap_formula: 2nd loses one gap (8) -> 92");
  assertEqual(results[2].points, 84, "gap_formula: 3rd -> 84");
  // Matches the design doc's flagged discrepancy: last place with 12
  // entrants lands on 12, not 0 — this is what Tjokkie described, not
  // a bug to silently "fix" with a different formula.
  assertEqual(results[11].points, 12, "gap_formula: 12th (last) place lands on 12, not 0 (as designed/flagged)");
}

// --- gap_formula: custom winner_points ---
{
  const rows = [row("a", 100), row("b", 110)];
  const results = computeWorkoutResults(rows, ["a", "b"], { method: "gap_formula", winner_points: 50 });
  assertEqual(results.map((r) => r.points), [50, 25], "gap_formula: winner_points=50, 2 entrants -> gap 25 -> 50,25");
}

// --- gap_formula: points never go negative ---
{
  const rows = Array.from({ length: 3 }, (_, i) => row(`r${i}`, 100 + i));
  const results = computeWorkoutResults(rows, rows.map((r) => r.registration_id), {
    method: "gap_formula",
    winner_points: 10,
  });
  // winner_points=10, 3 entrants -> gap = round(10/3) = 3 -> 10, 7, 4
  assertEqual(results.map((r) => r.points), [10, 7, 4], "gap_formula: small winner_points still floors correctly");
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
