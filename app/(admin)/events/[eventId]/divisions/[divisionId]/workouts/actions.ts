"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";

function path(eventId: string, divisionId: string) {
  return `/events/${eventId}/divisions/${divisionId}/workouts`;
}

export async function createWorkout(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!eventId || !divisionId || !name) return;

  const capMinutes = Number(formData.get("capMinutes"));
  const sequence = Number(formData.get("sequence"));

  const num = (key: string) => {
    const v = formData.get(key);
    if (!v || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  await supabase.from("workouts").insert({
    division_id: divisionId,
    name,
    sequence: Number.isNaN(sequence) ? 1 : sequence,
    cap_seconds: Number.isNaN(capMinutes) ? null : Math.round(capMinutes * 60),
    scoring_type: String(formData.get("scoringType") ?? "time"),
    tiebreak_enabled: formData.get("tiebreakEnabled") === "on",
    lane_count: num("laneCount"),
    heat_duration_minutes: num("heatDurationMinutes"),
    transition_minutes: num("transitionMinutes"),
  });
  revalidatePath(path(eventId, divisionId));
}

export async function deleteWorkout(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  if (!workoutId) return;

  await supabase.from("workouts").delete().eq("id", workoutId);
  revalidatePath(path(eventId, divisionId));
}

export async function addMovement(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!workoutId || !name) return;

  const num = (key: string) => {
    const v = formData.get(key);
    if (!v || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const sequence = Number(formData.get("sequence"));
  const rounds = Number(formData.get("rounds"));

  await supabase.from("workout_movements").insert({
    workout_id: workoutId,
    sequence: Number.isNaN(sequence) ? 1 : sequence,
    name,
    reps: num("reps"),
    load: String(formData.get("load") ?? "").trim() || null,
    rounds: Number.isNaN(rounds) || rounds < 1 ? 1 : rounds,
  });
  revalidatePath(path(eventId, divisionId));
}

export async function deleteMovement(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const movementId = String(formData.get("movementId") ?? "");
  if (!movementId) return;

  await supabase.from("workout_movements").delete().eq("id", movementId);
  revalidatePath(path(eventId, divisionId));
}

// Duplicates every workout (+ its movements) from another division into
// this one. Most divisions in a Rumble event share near-identical WODs
// with only small tweaks — this saves re-typing the whole scoresheet
// builder per division. Appends after whatever workouts already exist
// in the target division (sequence offset), rather than requiring an
// empty division.
export async function copyWorkoutsFromDivision(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const sourceDivisionId = String(formData.get("sourceDivisionId") ?? "");
  if (!divisionId || !sourceDivisionId || sourceDivisionId === divisionId) return;

  const [{ data: sourceWorkouts }, { data: existing }] = await Promise.all([
    supabase
      .from("workouts")
      .select("name, sequence, cap_seconds, scoring_type, tiebreak_enabled, lane_count, heat_duration_minutes, transition_minutes, workout_movements(sequence, name, reps, load, rounds)")
      .eq("division_id", sourceDivisionId)
      .order("sequence", { ascending: true }),
    supabase.from("workouts").select("sequence").eq("division_id", divisionId),
  ]);
  if (!sourceWorkouts || sourceWorkouts.length === 0) return;

  let nextSequence = Math.max(0, ...(existing ?? []).map((w) => w.sequence)) + 1;

  for (const w of sourceWorkouts) {
    const { data: inserted, error } = await supabase
      .from("workouts")
      .insert({
        division_id: divisionId,
        name: w.name,
        sequence: nextSequence++,
        cap_seconds: w.cap_seconds,
        scoring_type: w.scoring_type,
        tiebreak_enabled: w.tiebreak_enabled,
        lane_count: w.lane_count,
        heat_duration_minutes: w.heat_duration_minutes,
        transition_minutes: w.transition_minutes,
      })
      .select("id")
      .single();
    if (error || !inserted) continue;

    const movements = w.workout_movements ?? [];
    if (movements.length > 0) {
      await supabase.from("workout_movements").insert(
        movements.map((m) => ({
          workout_id: inserted.id,
          sequence: m.sequence,
          name: m.name,
          reps: m.reps,
          load: m.load,
          rounds: m.rounds,
        }))
      );
    }
  }

  revalidatePath(path(eventId, divisionId));
}
