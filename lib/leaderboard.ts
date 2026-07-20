import { formatTime } from "@/lib/scoring";

export type LeaderboardRow = {
  heat_assignment_id: string;
  workout_id: string;
  value_raw: { time_seconds?: number; reps?: number; load_kg?: number; no_rep?: boolean };
  registration_id: string;
  display_name: string;
};

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

// Competition-standard scoring: within a workout, every athlete who
// finished (recorded a time) outranks every athlete who was capped out
// (recorded reps instead) — finishers are ordered by time ascending,
// capped-out athletes by reps descending as a tiebreak among
// themselves. A missing score ranks worse than everyone. Points for
// that workout are (entrants - position + 1), so 1st place scores the
// most — the conventional bigger-is-better competition points table.
// Overall total is the sum of a registration's per-workout points,
// highest total wins.
export function computeWorkoutResults(rows: LeaderboardRow[], registrationIds: string[]): WorkoutResult[] {
  const nameByRegistration = new Map(rows.map((r) => [r.registration_id, r.display_name]));

  const finishers = rows
    .filter((r) => !r.value_raw.no_rep && r.value_raw.time_seconds != null)
    .map((r) => ({ registrationId: r.registration_id, time: r.value_raw.time_seconds! }))
    .sort((a, b) => a.time - b.time);

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
    }))
    .sort((a, b) => b.value - a.value);

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
    points: entrants - i,
  }));
}

// Full-division standings — one workout's results feed into an overall
// points total per registration, ranked highest-total-wins.
export function computeStandings(rows: LeaderboardRow[]): {
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
        registrationIds
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
