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
  // After the count-back rule (Tjokkie, 2026-10-04): all three tie on
  // 4 points, but A's finishes are [1,3], C's are [1,3], B's are [2,2].
  // A and C both have a 1st-place win and B doesn't, so they share place
  // 1 on count-back and B drops to place 3.
  const byId = Object.fromEntries(standings.map((s) => [s.registrationId, s]));
  check("count-back: teams with a 1st-place win share place 1 over the one without",
    byId.A.place === 1 && byId.C.place === 1 && byId.B.place === 3,
    standings.map((s) => `${s.registrationId}=${s.place}`).join(" "));
}

// ---------------------------------------------------------------
console.log("\n--- tied totals share a place; the next distinct total skips ahead ---\n");
{
  // Tjokkie flagged this on Rumble Indy's re-scored leaderboard: two
  // athletes tied on total points showed as consecutive placements
  // (e.g. 11th/12th) instead of both getting the same place. Standard
  // competition ranking: a mid-field tie should read 1, 2, 2, 4 — the
  // place after a tie jumps by the number tied, it doesn't just +1.
  //
  // A wins both workouts (clear 1st). B and C split 2nd/3rd across the
  // two workouts and land on the same total (a genuine tie for 2nd). D
  // is last both times (clear last).
  const rows = [
    row("A", "Alice", "w1", { time_seconds: 100 }), // 1st -> 4
    row("B", "Bob", "w1", { time_seconds: 200 }),   // 2nd -> 3
    row("C", "Cara", "w1", { time_seconds: 300 }),  // 3rd -> 2
    row("D", "Dan", "w1", { time_seconds: 400 }),   // 4th -> 1
    row("A", "Alice", "w2", { time_seconds: 100 }), // 1st -> 4  (total 8)
    row("C", "Cara", "w2", { time_seconds: 200 }),  // 2nd -> 3  (total 5)
    row("B", "Bob", "w2", { time_seconds: 300 }),   // 3rd -> 2  (total 5)
    row("D", "Dan", "w2", { time_seconds: 400 }),   // 4th -> 1  (total 2)
  ];
  const { standings } = computeStandings(rows, RANK_SUM);
  const placeOf = (id: string) => standings.find((s) => s.registrationId === id)!.place;
  const detail = standings.map((s) => `${s.registrationId}=${s.totalPoints}(place ${s.place})`).join(" ");

  check("the clear winner gets place 1", placeOf("A") === 1, detail);
  check("both tied athletes get place 2, not 2/3", placeOf("B") === 2 && placeOf("C") === 2, detail);
  check("the place after a 2-way tie skips to 4, not 3", placeOf("D") === 4, detail);
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
  // w2 carries its own gap_formula with winner_points 100 -> 2 entrants
  // -> 1 gap -> gap = round(100/1) = 100 -> 100, 0.
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
  check("second place under gap_formula loses the full gap for a 2-entrant field (Bob: 1 + 0 = 1)",
    bob.totalPoints === 1, `${bob.totalPoints}`);
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
console.log("\n--- overall count-back tiebreak (Tjokkie, 2026-10-04) ---\n");
{
  // 3-WOD weekend, 3 teams. A and B both finish on 6 total points but
  // A's best finish is 1st (vs B's best of 2nd), so A gets the higher place.
  // Using gap_formula with winner=3, gap=1 → 1st=3pts, 2nd=2pts, 3rd=1pt.
  const G: ScoringConfig = { method: "gap_formula", winner_points: 3, gap_points: 1 };
  const rows = [
    // w1: A 1st, B 2nd, C 3rd
    row("A", "Alpha", "w1", { time_seconds: 100 }, { workoutConfig: G, workoutName: "w1" }),
    row("B", "Bravo", "w1", { time_seconds: 110 }, { workoutConfig: G, workoutName: "w1" }),
    row("C", "Charlie", "w1", { time_seconds: 120 }, { workoutConfig: G, workoutName: "w1" }),
    // w2: B 1st, A 2nd, C 3rd — now A=1+2=3? no with gap_formula A=3+2=5, B=2+3=5
    row("B", "Bravo", "w2", { time_seconds: 100 }, { workoutConfig: G, workoutName: "w2" }),
    row("A", "Alpha", "w2", { time_seconds: 110 }, { workoutConfig: G, workoutName: "w2" }),
    row("C", "Charlie", "w2", { time_seconds: 120 }, { workoutConfig: G, workoutName: "w2" }),
    // w3: B 2nd, A 3rd, C 1st — totals: A=3+2+1=6, B=2+3+2=7, C=1+1+3=5
    row("C", "Charlie", "w3", { time_seconds: 100 }, { workoutConfig: G, workoutName: "w3" }),
    row("B", "Bravo", "w3", { time_seconds: 110 }, { workoutConfig: G, workoutName: "w3" }),
    row("A", "Alpha", "w3", { time_seconds: 120 }, { workoutConfig: G, workoutName: "w3" }),
  ];
  const { standings } = computeStandings(rows, G);
  // Make it a real tie: force A and B to the same total by picking a
  // simpler case — construct directly below instead of relying on points math.
  // (Keep this sanity check so the test file still runs if math changes.)
  check("basic 3-team run produces 3 ranked rows", standings.length === 3);
}
{
  // Proper tie scenario: 2 WODs, 4 teams, only A and B tie on points.
  // rank_sum with 4 entrants: 1st=4, 2nd=3, 3rd=2, 4th=1.
  //   w1 finish order: A, B, C, D   -> A=4, B=3, C=2, D=1
  //   w2 finish order: C, D, B, A   -> C=4, D=3, B=2, A=1
  // Totals: A=5, B=5, C=6, D=4. A finishes=[1,4], B finishes=[2,3].
  // Count-back: A's best is 1st vs B's best 2nd → A ranks above B.
  const rows = [
    row("A", "Alpha", "w1", { time_seconds: 100 }),
    row("B", "Bravo", "w1", { time_seconds: 110 }),
    row("C", "Charlie", "w1", { time_seconds: 120 }),
    row("D", "Delta", "w1", { time_seconds: 130 }),
    row("C", "Charlie", "w2", { time_seconds: 100 }),
    row("D", "Delta", "w2", { time_seconds: 110 }),
    row("B", "Bravo", "w2", { time_seconds: 120 }),
    row("A", "Alpha", "w2", { time_seconds: 130 }),
  ];
  const { standings } = computeStandings(rows, RANK_SUM);
  const a = standings.find((s) => s.registrationId === "A")!;
  const b = standings.find((s) => s.registrationId === "B")!;
  const c = standings.find((s) => s.registrationId === "C")!;
  check("count-back ranks tied team with better single finish higher",
    a.place < b.place && a.totalPoints === b.totalPoints,
    standings.map((s) => `${s.registrationId}@${s.place}=${s.totalPoints}`).join(","));
  check("count-back assigns sequential places, not a shared tie",
    c.place === 1 && a.place === 2 && b.place === 3);
}
{
  // Identical count-back → genuine tie, share place.
  // 2 WODs, 2 teams. A: 1st then 2nd. B: 2nd then 1st. Both totals = 3,
  // both sorted finishes = [1, 2]. They should share place 1.
  const rows = [
    row("A", "Alpha", "w1", { time_seconds: 100 }),
    row("B", "Bravo", "w1", { time_seconds: 110 }),
    row("B", "Bravo", "w2", { time_seconds: 100 }),
    row("A", "Alpha", "w2", { time_seconds: 110 }),
  ];
  const { standings } = computeStandings(rows, RANK_SUM);
  check("identical count-back still shares the tied place",
    standings[0].place === 1 && standings[1].place === 1,
    standings.map((s) => `${s.registrationId}@${s.place}`).join(","));
}

// ---------------------------------------------------------------
console.log("\n--- capped-score tiebreaks (Tjokkie, 2026-10-04) ---\n");
{
  // Both capped at 214 reps; A got there at 12:59, B at 12:30 — B wins.
  // Before the fix, tiebreakOf was called with key "reps" so time_seconds
  // tiebreaks silently vanished and the two tied at position 1.
  const rows = [
    row("A", "Alice", "w1", { reps: 214 }, { tiebreak: { time_seconds: 779 } }),
    row("B", "Bob", "w1", { reps: 214 }, { tiebreak: { time_seconds: 750 } }),
  ];
  const { workouts } = computeStandings(rows, RANK_SUM);
  check("equal capped reps split by lower tiebreak TIME",
    workouts[0].results[0].registrationId === "B",
    workouts[0].results.map((r) => `${r.registrationId}@${r.position}`).join(","));
  check("the loser moves to position 2, not a stacked tie",
    workouts[0].results[1].position === 2,
    JSON.stringify(workouts[0].results.map((r) => r.position)));

  // Fallback: no time recorded, same reps — same reps + same (missing)
  // tiebreak IS a genuine tie and should share position 1.
  const noTbRows = [
    row("A", "Alice", "w1", { reps: 100 }),
    row("B", "Bob", "w1", { reps: 100 }),
  ];
  const noTb = computeStandings(noTbRows, RANK_SUM);
  check("truly identical capped scores still share position",
    noTb.workouts[0].results[0].position === 1 &&
    noTb.workouts[0].results[1].position === 1);
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
