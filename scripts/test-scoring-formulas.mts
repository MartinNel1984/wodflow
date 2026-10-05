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
  // Linear 100 -> 1 interpolation (Tjokkie, 2026-10-05): last place
  // lands at exactly 1 regardless of field size, intermediate points
  // rounded. For 12 entrants, raw gap of 99/11 is exact (= 9), so the
  // whole table matches integer-gap arithmetic coincidentally.
  assertEqual(results[11].points, 1, "gap_formula: 12th (last) lands at 1");
}

// --- gap_formula: custom winner_points, last place still = 1 ---
{
  const rows = [row("a", 100), row("b", 110)];
  const results = computeWorkoutResults(rows, ["a", "b"], { method: "gap_formula", winner_points: 50 });
  // 2 entrants with linear 50 -> 1: positions get 50 and 1.
  assertEqual(results.map((r) => r.points), [50, 1], "gap_formula: winner_points=50, 2 entrants -> 50,1");
}

// --- gap_formula: small winner_points still bottoms at 1, not 0 ---
{
  const rows = Array.from({ length: 3 }, (_, i) => row(`r${i}`, 100 + i));
  const results = computeWorkoutResults(rows, rows.map((r) => r.registration_id), {
    method: "gap_formula",
    winner_points: 10,
  });
  // Linear 10 -> 1 across 3 entrants: 10, round(10 - 9/2)=6, 1
  assertEqual(results.map((r) => r.points), [10, 6, 1], "gap_formula: 10,6,1 for 3 entrants with winner_points=10");
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

// --- a genuine tie (same time, no tiebreak) shares position AND points ---
// Tjokkie, 2026-09-29: two teams with the identical time and no tiebreak
// entered were getting sequential positions/points from the stable sort
// — whichever row the DB happened to return first quietly "won". Now
// they share the higher position, same "1, 1, 3" rule computeStandings
// already applies to overall totals.
{
  const rows = [row("a", 300), row("b", 300), row("c", 400)];
  const results = computeWorkoutResults(rows, ["a", "b", "c"], { method: "rank_sum" });
  assertEqual(
    results.map((r) => [r.registrationId, r.position, r.points]),
    [
      ["a", 1, 3],
      ["b", 1, 3],
      ["c", 3, 1],
    ],
    "genuine tie: both tied athletes share position 1 and 3 points; next distinct time resumes at position 3"
  );
}

// --- a tie broken by tiebreak is NOT treated as a tie ---
{
  const rows = [row("a", 300, 50), row("b", 300, 45), row("c", 400)];
  const results = computeWorkoutResults(rows, ["a", "b", "c"], { method: "rank_sum" });
  assertEqual(
    results.map((r) => [r.registrationId, r.position, r.points]),
    [
      ["b", 1, 3],
      ["a", 2, 2],
      ["c", 3, 1],
    ],
    "a recorded tiebreak still resolves the tie into distinct positions, not shared ones"
  );
}

console.log(failures === 0 ? "\nAll scoring formula checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures > 0 ? 1 : 0);
