import { formatTime } from "@/lib/scoring";

export type LeaderboardRow = {
  heat_assignment_id: string;
  workout_id: string;
  value_raw: { time_seconds?: number; reps?: number; load_kg?: number; no_rep?: boolean };
  tiebreak_value: { time_seconds?: number; reps?: number } | null;
  registration_id: string;
  display_name: string;
};

export type ScoringConfig = { method: "rank_sum" } | { method: "gap_formula"; winner_points?: number };

export type WorkoutResult = {
  registrationId: string;
  displayName: string;
  display: string; // formatted time or "N reps"
  capped: boolean; // true when this entry recorded reps instead of a finish time
  position: number;
  points: number;
};

export type Standing = {
  registrationId: string;
  displayName: string;
  totalPoints: number;
};

// Two point tables, both driven by divisions.scoring_config:
//   rank_sum    — points = entrants - position + 1 (today's default,
//                 unchanged behavior for every division that hasn't
//                 opted into the other one).
//   gap_formula — Tjokkie's proposed model: winner scores winner_points
//                 (100 by default), each place down loses a fixed gap
//                 of round(winner_points / entrants), floored at 0.
//                 Note: with small fields this doesn't necessarily
//                 reach exactly 0 at last place (e.g. 12 entrants ->
//                 gap 8 -> last place lands on 12, not 0) — that's
//                 the formula as described, not a bug; the exact
//                 rounding/edge behavior is still an open question to
//                 confirm with Tjokkie, not something to silently
//                 "fix" by guessing a different formula.
// Exported for reuse by lib/series.ts — season points (Milestone 18)
// are the same pluggable formula applied to an athlete's OVERALL
// event placement instead of a per-workout one.
export function pointsForPosition(position: number, entrants: number, config: ScoringConfig): number {
  if (config.method === "gap_formula") {
    const winnerPoints = config.winner_points ?? 100;
    const gap = Math.round(winnerPoints / entrants);
    return Math.max(0, winnerPoints - (position - 1) * gap);
  }
  return entrants - position + 1;
}

function tiebreakOf(row: { tiebreak_value: LeaderboardRow["tiebreak_value"] }, key: "time_seconds" | "reps") {
  return row.tiebreak_value?.[key];
}

// Competition-standard scoring: within a workout, every athlete who
// finished (recorded a time) outranks every athlete who was capped out
// (recorded reps instead) — finishers are ordered by time ascending,
// capped-out athletes by reps descending as a tiebreak among
// themselves. When two athletes land on the exact same primary score,
// tiebreak_value (same shape as the main score, entered alongside it —
// see Milestone 12) breaks the tie the same direction as the primary
// metric; if neither or only one has a tiebreak recorded, the tie is
// left as-is (stable order) rather than guessed. A missing score ranks
// worse than everyone. Overall total is the sum of a registration's
// per-workout points, highest total wins.
export function computeWorkoutResults(
  rows: LeaderboardRow[],
  registrationIds: string[],
  scoringConfig: ScoringConfig = { method: "rank_sum" }
): WorkoutResult[] {
  const nameByRegistration = new Map(rows.map((r) => [r.registration_id, r.display_name]));

  const finishers = rows
    .filter((r) => !r.value_raw.no_rep && r.value_raw.time_seconds != null)
    .map((r) => ({
      registrationId: r.registration_id,
      time: r.value_raw.time_seconds!,
      tiebreak: tiebreakOf(r, "time_seconds"),
    }))
    .sort((a, b) => a.time - b.time || (a.tiebreak ?? Infinity) - (b.tiebreak ?? Infinity));

  // Reps or load — whichever secondary metric was recorded (either a
  // capped-out time-workout entry, or the primary metric for a pure
  // reps/load division that has no finish-time concept at all).
  const finishedIds = new Set(finishers.map((f) => f.registrationId));
  const secondary = rows
    .filter((r) => !r.value_raw.no_rep && (r.value_raw.reps != null || r.value_raw.load_kg != null) && !finishedIds.has(r.registration_id))
    .map((r) => ({
      registrationId: r.registration_id,
      value: (r.value_raw.reps ?? r.value_raw.load_kg)!,
      unit: r.value_raw.reps != null ? "reps" : "kg",
      tiebreak: tiebreakOf(r, "reps"),
    }))
    .sort((a, b) => b.value - a.value || (b.tiebreak ?? -Infinity) - (a.tiebreak ?? -Infinity));

  const ordered = [
    ...finishers.map((f) => ({ registrationId: f.registrationId, display: formatTime(f.time), capped: false })),
    ...secondary.map((s) => ({ registrationId: s.registrationId, display: `${s.value} ${s.unit}`, capped: true })),
  ];

  const entrants = registrationIds.length;
  return ordered.map((entry, i) => ({
    registrationId: entry.registrationId,
    displayName: nameByRegistration.get(entry.registrationId) ?? "Unnamed",
    display: entry.display,
    capped: entry.capped,
    position: i + 1,
    points: pointsForPosition(i + 1, entrants, scoringConfig),
  }));
}

// Full-division standings — one workout's results feed into an overall
// points total per registration, ranked highest-total-wins.
export function computeStandings(
  rows: LeaderboardRow[],
  scoringConfig: ScoringConfig = { method: "rank_sum" }
): {
  standings: Standing[];
  workouts: { id: string; results: WorkoutResult[] }[];
} {
  const workoutIds = [...new Set(rows.map((r) => r.workout_id))].sort();
  const registrationIds = [...new Set(rows.map((r) => r.registration_id))];
  const nameByRegistration = new Map(rows.map((r) => [r.registration_id, r.display_name]));

  const resultsByWorkout = new Map<string, WorkoutResult[]>();
  for (const workoutId of workoutIds) {
    resultsByWorkout.set(
      workoutId,
      computeWorkoutResults(
        rows.filter((r) => r.workout_id === workoutId),
        registrationIds,
        scoringConfig
      )
    );
  }

  const pointsByRegistration = new Map<string, number>();
  for (const results of resultsByWorkout.values()) {
    for (const r of results) {
      pointsByRegistration.set(r.registrationId, (pointsByRegistration.get(r.registrationId) ?? 0) + r.points);
    }
  }

  const standings: Standing[] = registrationIds
    .map((registrationId) => ({
      registrationId,
      displayName: nameByRegistration.get(registrationId) ?? "Unnamed",
      totalPoints: pointsByRegistration.get(registrationId) ?? 0,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const workouts = workoutIds.map((id) => ({ id, results: resultsByWorkout.get(id)! }));

  return { standings, workouts };
}
