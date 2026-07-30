"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function path(eventId: string, divisionId: string) {
  return `/events/${eventId}/divisions/${divisionId}/workouts`;
}

function pathWithError(eventId: string, divisionId: string, message: string) {
  return `${path(eventId, divisionId)}?error=${encodeURIComponent(message)}`;
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

  const pointsMethod = String(formData.get("pointsMethod") ?? "");
  const winnerPoints = num("winnerPoints");
  const gapPoints = num("gapPoints");
  // Typing a points value is itself the signal to override — the
  // pointsMethod dropdown alone used to gate this, so an admin who
  // filled in "Points for 1st" but forgot to also flip the dropdown
  // had their number silently discarded in favor of the division
  // default, with no error or feedback.
  const scoringConfig =
    pointsMethod === "gap_formula" || winnerPoints != null || gapPoints != null
      ? {
          method: "gap_formula",
          ...(winnerPoints != null ? { winner_points: winnerPoints } : {}),
          ...(gapPoints != null ? { gap_points: gapPoints } : {}),
        }
      : null; // null = inherit the division's default scoring formula

  const { error } = await supabase.from("workouts").insert({
    division_id: divisionId,
    name,
    sequence: Number.isNaN(sequence) ? 1 : sequence,
    cap_seconds: Number.isNaN(capMinutes) ? null : Math.round(capMinutes * 60),
    scoring_type: String(formData.get("scoringType") ?? "time"),
    tiebreak_enabled: formData.get("tiebreakEnabled") === "on",
    lane_count: num("laneCount"),
    heat_duration_minutes: num("heatDurationMinutes"),
    transition_minutes: num("transitionMinutes"),
    scoring_config: scoringConfig,
  });
  if (error) {
    redirect(
      pathWithError(
        eventId,
        divisionId,
        error.code === "23505"
          ? `A workout already has order/sequence ${sequence} in this division — use a different order.`
          : "Could not create workout — please try again."
      )
    );
  }
  revalidatePath(path(eventId, divisionId));
}

export async function updateWorkout(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!workoutId || !name) return;

  const capMinutes = Number(formData.get("capMinutes"));
  const sequence = Number(formData.get("sequence"));

  const num = (key: string) => {
    const v = formData.get(key);
    if (!v || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const pointsMethod = String(formData.get("pointsMethod") ?? "");
  const winnerPoints = num("winnerPoints");
  const gapPoints = num("gapPoints");
  // Typing a points value is itself the signal to override — the
  // pointsMethod dropdown alone used to gate this, so an admin who
  // filled in "Points for 1st" but forgot to also flip the dropdown
  // had their number silently discarded in favor of the division
  // default, with no error or feedback.
  const scoringConfig =
    pointsMethod === "gap_formula" || winnerPoints != null || gapPoints != null
      ? {
          method: "gap_formula",
          ...(winnerPoints != null ? { winner_points: winnerPoints } : {}),
          ...(gapPoints != null ? { gap_points: gapPoints } : {}),
        }
      : null; // null = inherit the division's default scoring formula

  const { data: updated, error } = await supabase
    .from("workouts")
    .update({
      name,
      sequence: Number.isNaN(sequence) ? 1 : sequence,
      cap_seconds: Number.isNaN(capMinutes) ? null : Math.round(capMinutes * 60),
      scoring_type: String(formData.get("scoringType") ?? "time"),
      tiebreak_enabled: formData.get("tiebreakEnabled") === "on",
      lane_count: num("laneCount"),
      heat_duration_minutes: num("heatDurationMinutes"),
      transition_minutes: num("transitionMinutes"),
      scoring_config: scoringConfig,
    })
    .eq("id", workoutId)
    .select("id");
  if (error) {
    redirect(
      pathWithError(
        eventId,
        divisionId,
        error.code === "23505"
          ? `Another workout already has order/sequence ${sequence} in this division — use a different order.`
          : "Could not save workout — please try again."
      )
    );
  }
  // RLS can filter an update to zero rows without an error (e.g. this
  // workout no longer belongs to your organization) — the swallowed
  // no-op looks identical to "nothing happened" from the admin's side.
  if (!updated || updated.length === 0) {
    redirect(pathWithError(eventId, divisionId, "Could not save workout — it may no longer exist."));
  }
  revalidatePath(path(eventId, divisionId));
}

export async function deleteWorkout(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  if (!workoutId) return;

  // Freeze this workout's scoring config onto its already-recorded scores
  // before the delete detaches workout_ref_id (set null) — otherwise a
  // workout with its own winner_points/gap_points override would silently
  // fall back to the division default for historical scores once deleted.
  const { data: workout } = await supabase
    .from("workouts")
    .select("scoring_config")
    .eq("id", workoutId)
    .single();
  if (workout?.scoring_config) {
    await supabase
      .from("scores")
      .update({ workout_scoring_config_snapshot: workout.scoring_config })
      .eq("workout_ref_id", workoutId);
  }

  const { error } = await supabase.from("workouts").delete().eq("id", workoutId);
  if (error) {
    redirect(pathWithError(eventId, divisionId, "Could not delete workout — please try again."));
  }
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

  const { error } = await supabase.from("workout_movements").insert({
    workout_id: workoutId,
    sequence: Number.isNaN(sequence) ? 1 : sequence,
    name,
    reps: num("reps"),
    load: String(formData.get("load") ?? "").trim() || null,
    rounds: Number.isNaN(rounds) || rounds < 1 ? 1 : rounds,
  });
  if (error) {
    redirect(
      pathWithError(
        eventId,
        divisionId,
        error.code === "23505"
          ? `Another movement already has order/sequence ${sequence} for this workout — use a different order.`
          : "Could not add movement — please try again."
      )
    );
  }
  revalidatePath(path(eventId, divisionId));
}

export async function deleteMovement(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const movementId = String(formData.get("movementId") ?? "");
  if (!movementId) return;

  const { error } = await supabase.from("workout_movements").delete().eq("id", movementId);
  if (error) {
    redirect(pathWithError(eventId, divisionId, "Could not remove movement — please try again."));
  }
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
