import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/scoring";
import type { BrandKit } from "@/lib/brandKit";
import LeaderboardView from "./view";

type Row = {
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
function computeWorkoutResults(rows: Row[], registrationIds: string[]): WorkoutResult[] {
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

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ divisionId: string }>;
}) {
  const { divisionId } = await params;
  const supabase = await createClient();

  const [{ data: division }, { data: rows }] = await Promise.all([
    supabase
      .from("divisions")
      .select(
        "name, workout_scoring_type, events(brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline))"
      )
      .eq("id", divisionId)
      .single(),
    supabase
      .from("public_leaderboard")
      .select("heat_assignment_id, workout_id, value_raw, registration_id, display_name")
      .eq("division_id", divisionId),
  ]);

  const allRows = (rows ?? []) as Row[];
  const workoutIds = [...new Set(allRows.map((r) => r.workout_id))].sort();
  const registrationIds = [...new Set(allRows.map((r) => r.registration_id))];
  const nameByRegistration = new Map(allRows.map((r) => [r.registration_id, r.display_name]));

  const resultsByWorkout = new Map<string, WorkoutResult[]>();
  for (const workoutId of workoutIds) {
    resultsByWorkout.set(
      workoutId,
      computeWorkoutResults(
        allRows.filter((r) => r.workout_id === workoutId),
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

  const event = Array.isArray(division?.events) ? division.events[0] : division?.events;
  const brandKit = (Array.isArray(event?.brand_kits) ? event.brand_kits[0] : event?.brand_kits) as
    | BrandKit
    | null
    | undefined;

  return (
    <LeaderboardView
      divisionName={division?.name ?? "Leaderboard"}
      standings={standings}
      workouts={workouts}
      brandKit={brandKit ?? null}
    />
  );
}
