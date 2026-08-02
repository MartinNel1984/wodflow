// Unit tests for computeStandings — the function that turns per-workout
// results into the OVERALL leaderboard and, at a real event, the podium.
//
// test-scoring-formulas.mts already covers pointsForPosition and a single
// workout's results. This covers the aggregation ACROSS workouts, which
// had no dedicated test despite being the highest-stakes pure logic in
// the app (it decides who wins prize money).
//
//   npx tsx scripts/test-standings.mts

import { computeStandings, type LeaderboardRow, type ScoringConfig } from "../lib/leaderboard";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`PASS: ${label}`); }
  else { fail++; console.log(`FAIL: ${label}${detail ? " — " + detail : ""}`); }
}

// Minimal row builder — only the fields computeStandings actually reads.
function row(
  registrationId: string,
  displayName: string,
  workoutId: string,
  value: LeaderboardRow["value_raw"],
  opts: { tiebreak?: LeaderboardRow["tiebreak_value"]; workoutConfig?: ScoringConfig; workoutName?: string } = {}
): LeaderboardRow {
  return {
    heat_assignment_id: `${registrationId}-${workoutId}`,
    workout_id: workoutId,
    value_raw: value,
    tiebreak_value: opts.tiebreak ?? null,
    registration_id: registrationId,
    display_name: displayName,
    workout_name: opts.workoutName ?? workoutId,
    workout_scoring_config: opts.workoutConfig ?? null,
  };
}

const RANK_SUM: ScoringConfig = { method: "rank_sum" };

// ---------------------------------------------------------------
console.log("\n--- points sum across workouts ---\n");
{
  // 3 athletes, 2 workouts. rank_sum with 3 entrants => 3,2,1 per workout.
  // A: 1st then 3rd  => 3 + 1 = 4
  // B: 2nd then 2nd  => 2 + 2 = 4
  // C: 3rd then 1st  => 1 + 3 = 4   (a genuine three-way tie)
  const rows = [
    row("A", "Alice", "w1", { time_seconds: 100 }),
    row("B", "Bob", "w1", { time_seconds: 200 }),
    row("C", "Cara", "w1", { time_seconds: 300 }),
    row("A", "Alice", "w2", { time_seconds: 300 }),
    row("B", "Bob", "w2", { time_seconds: 200 }),
    row("C", "Cara", "w2", { time_seconds: 100 }),
  ];
  const { standings, workouts } = computeStandings(rows, RANK_SUM);
  check("all 3 athletes appear in standings", standings.length === 3, `got ${standings.length}`);
  check("both workouts are reported", workouts.length === 2, `got ${workouts.length}`);
  check("points are summed across workouts (all tie on 4)",
    standings.every((s) => s.totalPoints === 4),
    standings.map((s) => `${s.registrationId}=${s.totalPoints}`).join(" "));
  check("each athlete has a per-workout score entry for both workouts",
    standings.every((s) => Object.keys(s.workoutScores).length === 2));
}

// ---------------------------------------------------------------
console.log("\n--- overall ranking is by total points, highest first ---\n");
{
  const rows = [
    row("A", "Alice", "w1", { time_seconds: 100 }), // 1st -> 3
    row("B", "Bob", "w1", { time_seconds: 200 }),   // 2nd -> 2
    row("C", "Cara", "w1", { time_seconds: 300 }),  // 3rd -> 1
    row("A", "Alice", "w2", { time_seconds: 100 }), // 1st -> 3  (total 6)
    row("B", "Bob", "w2", { time_seconds: 300 }),   // 3rd -> 1  (total 3)
    row("C", "Cara", "w2", { time_seconds: 200 }),  // 2nd -> 2  (total 3)
  ];
  const { standings } = computeStandings(rows, RANK_SUM);
  check("winner is the highest total", standings[0].registrationId === "A", standings[0].registrationId);
  check("winner's total is correct", standings[0].totalPoints === 6, `${standings[0].totalPoints}`);
  check("standings are sorted descending",
    standings.every((s, i) => i === 0 || standings[i - 1].totalPoints >= s.totalPoints));
}

// ---------------------------------------------------------------
console.log("\n--- an athlete who misses a workout ---\n");
{
  // C has no row for w2 at all (injury / no-show). Documented intent:
  // "a missing score ranks worse than everyone".
  const rows = [
    row("A", "Alice", "w1", { time_seconds: 100 }),
    row("B", "Bob", "w1", { time_seconds: 200 }),
    row("C", "Cara", "w1", { time_seconds: 300 }),
    row("A", "Alice", "w2", { time_seconds: 100 }),
    row("B", "Bob", "w2", { time_seconds: 200 }),
  ];
  const { standings } = computeStandings(rows, RANK_SUM);
  const cara = standings.find((s) => s.registrationId === "C")!;
  check("the absent athlete still appears in standings", !!cara);
  check("they score nothing for the workout they missed",
    cara.workoutScores["w2"] === undefined, JSON.stringify(cara.workoutScores));
  check("a missed workout costs points (Cara 1, below Bob)",
    cara.totalPoints === 1, `${cara.totalPoints}`);
  check("the athlete who missed a workout ranks last",
    standings[standings.length - 1].registrationId === "C",
    standings.map((s) => s.registrationId).join(">"));
}

// ---------------------------------------------------------------
console.log("\n--- finishers always beat capped athletes ---\n");
{
  const rows = [
    // A capped at 50 reps; B finished slowly; C finished fast.
    row("A", "Alice", "w1", { reps: 50 }),
    row("B", "Bob", "w1", { time_seconds: 899 }),
    row("C", "Cara", "w1", { time_seconds: 100 }),
  ];
  const { workouts } = computeStandings(rows, RANK_SUM);
  const order = workouts[0].results.map((r) => r.registrationId);
  check("both finishers outrank the capped athlete regardless of time",
    order[0] === "C" && order[1] === "B" && order[2] === "A", order.join(">"));
  check("the capped entry is flagged as capped",
    workouts[0].results.find((r) => r.registrationId === "A")!.capped === true);
}

// ---------------------------------------------------------------
console.log("\n--- a workout where everyone caps out ---\n");
{
  const rows = [
    row("A", "Alice", "w1", { reps: 120 }),
    row("B", "Bob", "w1", { reps: 140 }),
    row("C", "Cara", "w1", { reps: 100 }),
  ];
  const { standings, workouts } = computeStandings(rows, RANK_SUM);
  const order = workouts[0].results.map((r) => r.registrationId);
  check("capped athletes rank by reps DESCENDING (more reps is better)",
    order[0] === "B" && order[1] === "A" && order[2] === "C", order.join(">"));
  check("winner of an all-capped workout still tops the standings",
    standings[0].registrationId === "B", standings[0].registrationId);
}

// ---------------------------------------------------------------
console.log("\n--- per-workout scoring_config overrides the division default ---\n");
{
  // w1 uses the division default (rank_sum, 2 entrants -> 2,1).
  // w2 carries its own gap_formula with winner_points 100 -> 100, 50.
  const gap: ScoringConfig = { method: "gap_formula", winner_points: 100 };
  const rows = [
    row("A", "Alice", "w1", { time_seconds: 100 }),
    row("B", "Bob", "w1", { time_seconds: 200 }),
    row("A", "Alice", "w2", { time_seconds: 100 }, { workoutConfig: gap }),
    row("B", "Bob", "w2", { time_seconds: 200 }, { workoutConfig: gap }),
  ];
  const { standings } = computeStandings(rows, RANK_SUM);
  const alice = standings.find((s) => s.registrationId === "A")!;
  check("workout with its own config uses it (Alice: 2 + 100 = 102)",
    alice.totalPoints === 102, `${alice.totalPoints}`);
  const bob = standings.find((s) => s.registrationId === "B")!;
  check("second place under gap_formula loses one gap (Bob: 1 + 50 = 51)",
    bob.totalPoints === 51, `${bob.totalPoints}`);
}

// ---------------------------------------------------------------
console.log("\n--- tiebreak resolution feeds through to standings ---\n");
{
  const rows = [
    row("A", "Alice", "w1", { time_seconds: 300 }, { tiebreak: { time_seconds: 50 } }),
    row("B", "Bob", "w1", { time_seconds: 300 }, { tiebreak: { time_seconds: 45 } }),
  ];
  const { standings, workouts } = computeStandings(rows, RANK_SUM);
  check("equal primary times are split by the lower tiebreak",
    workouts[0].results[0].registrationId === "B",
    workouts[0].results.map((r) => r.registrationId).join(">"));
  check("the tiebreak winner leads the standings", standings[0].registrationId === "B");
}

// ---------------------------------------------------------------
console.log("\n--- degenerate inputs must not crash ---\n");
{
  const empty = computeStandings([], RANK_SUM);
  check("no scores at all -> empty standings, no throw",
    empty.standings.length === 0 && empty.workouts.length === 0);

  const single = computeStandings([row("A", "Alice", "w1", { time_seconds: 100 })], RANK_SUM);
  check("a single athlete gets 1st and full points",
    single.standings.length === 1 && single.standings[0].totalPoints === 1,
    JSON.stringify(single.standings));

  const noRep = computeStandings([
    row("A", "Alice", "w1", { no_rep: true }),
    row("B", "Bob", "w1", { time_seconds: 120 }),
  ], RANK_SUM);
  const noRepOrder = noRep.workouts[0].results.map((r) => r.registrationId);
  check("a no-rep is excluded from the ranked results",
    !noRepOrder.includes("A") && noRepOrder.includes("B"), noRepOrder.join(">"));
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
process.exit(fail > 0 ? 1 : 0);
