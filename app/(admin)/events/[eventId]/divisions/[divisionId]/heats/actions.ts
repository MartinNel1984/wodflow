"use server";

import { requireOrganizer, requirePrivileged } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { generateHeats, type RosterEntry } from "@/lib/heats";
import { parseTime } from "@/lib/scoring";

// Whole-workout regeneration. Only ever touches heats/assignments in
// 'scheduled' status — heats already 'in_progress' or 'completed' are
// left untouched, so re-running this mid-event can't wipe a workout
// that's already underway. Heats belong to a specific workout (not
// just the division) since lane count and heat duration change
// workout to workout.
export async function generateHeatsForDivision(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  const laneCount = Number(formData.get("laneCount"));
  const heatDurationMinutes = Number(formData.get("heatDurationMinutes"));
  const transitionMinutes = Number(formData.get("transitionMinutes") ?? 0);
  const startDate = String(formData.get("startDate") ?? "");
  const startTimeOfDay = String(formData.get("startTimeOfDay") ?? "");
  if (!eventId || !divisionId || !workoutId || !laneCount || !heatDurationMinutes || !startDate || !startTimeOfDay) {
    throw new Error(
      "Missing required fields — workout, lane count, heat duration, date, and time are all required."
    );
  }

  // Split date + time inputs (native type="date"/type="time") are far
  // less prone to mis-entry than a combined datetime-local field —
  // fixing a real bug where a garbled datetime-local value would fail
  // native browser validation silently, making "Generate" appear to do
  // nothing at all.
  const startTime = new Date(`${startDate}T${startTimeOfDay}`);
  if (isNaN(startTime.getTime())) {
    throw new Error(`Invalid date/time: "${startDate} ${startTimeOfDay}". Please re-enter both fields.`);
  }

  const { data: registrations, error: regError } = await supabase
    .from("registrations")
    .select("id, registration_order")
    .eq("division_id", divisionId)
    .in("payment_status", ["paid", "waived"])
    .order("registration_order", { ascending: true });
  if (regError) throw regError;
  if (!registrations || registrations.length === 0) {
    throw new Error(
      "No paid or waived registrations found for this division — heats can't be generated until athletes have registered and paid."
    );
  }

  // Exclude registrations already locked into an in-progress/completed
  // heat for THIS workout. Only 'scheduled' heats/assignments get wiped
  // above, so without this exclusion an athlete already scored in a
  // completed heat would also get a fresh assignment in a new heat here
  // — two heat_assignments rows for the same registration+workout, which
  // computeWorkoutResults/computeStandings would then rank and count
  // twice, silently corrupting the leaderboard.
  const { data: lockedHeats } = await supabase
    .from("heats")
    .select("id")
    .eq("workout_id", workoutId)
    .neq("status", "scheduled");
  const lockedHeatIds = (lockedHeats ?? []).map((h) => h.id);
  const alreadyAssignedIds = new Set<string>();
  if (lockedHeatIds.length > 0) {
    const { data: lockedAssignments } = await supabase
      .from("heat_assignments")
      .select("registration_id")
      .in("heat_id", lockedHeatIds);
    for (const a of lockedAssignments ?? []) alreadyAssignedIds.add(a.registration_id);
  }

  const roster: RosterEntry[] = (registrations ?? [])
    .filter((r) => !alreadyAssignedIds.has(r.id))
    .map((r) => ({
      registrationId: r.id,
      registrationOrder: r.registration_order,
      seedRank: null,
    }));

  const { heats, assignments } = generateHeats({
    laneCount,
    heatDurationMinutes,
    transitionMinutes,
    startTime,
    roster,
  });

  // Only remove heats that haven't started — never touch in-progress/completed.
  // Scoped to this workout so regenerating one WOD's heats can't wipe
  // another workout's already-scheduled heats in the same division.
  const { data: scheduledHeats } = await supabase
    .from("heats")
    .select("id")
    .eq("workout_id", workoutId)
    .eq("status", "scheduled");
  const scheduledHeatIds = (scheduledHeats ?? []).map((h) => h.id);
  if (scheduledHeatIds.length > 0) {
    await supabase.from("heat_assignments").delete().in("heat_id", scheduledHeatIds);
    await supabase.from("heats").delete().in("id", scheduledHeatIds);
  }

  const { data: insertedHeats, error: heatsError } = await supabase
    .from("heats")
    .insert(
      heats.map((h) => ({
        event_id: eventId,
        division_id: divisionId,
        workout_id: workoutId,
        heat_number: h.heatNumber,
        start_time: h.startTime.toISOString(),
        end_time: h.endTime.toISOString(),
      }))
    )
    .select("id, heat_number");
  if (heatsError) throw heatsError;

  const heatIdByNumber = new Map((insertedHeats ?? []).map((h) => [h.heat_number, h.id]));
  const assignmentRows = assignments.map((a) => ({
    heat_id: heatIdByNumber.get(a.heatNumber),
    registration_id: a.registrationId,
    lane_number: a.laneNumber,
  }));
  if (assignmentRows.length > 0) {
    const { error: assignError } = await supabase.from("heat_assignments").insert(assignmentRows);
    if (assignError) throw assignError;
  }

  revalidatePath(`/events/${eventId}/divisions/${divisionId}/heats`);
}

// Surgical manual override — moves one registration to a different
// lane/heat without touching any other assignment. The DB's unique
// constraint on (heat_id, lane_number) catches accidental double-booking.
export async function moveAssignment(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const newHeatId = String(formData.get("heatId") ?? "");
  const newLaneNumber = Number(formData.get("laneNumber"));
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  if (!assignmentId || !newHeatId || !newLaneNumber) return;

  const { error } = await supabase
    .from("heat_assignments")
    .update({ heat_id: newHeatId, lane_number: newLaneNumber })
    .eq("id", assignmentId);
  if (error) {
    if (error.code === "23505") {
      throw new Error(`Lane ${newLaneNumber} is already taken in that heat — pick a free lane.`);
    }
    throw error;
  }

  revalidatePath(`/events/${eventId}/divisions/${divisionId}/heats`);
}

// Corrects a score by inserting a new row, same as the judge scoring
// screen — scores are append-only (see schema.sql's note on
// public.scores) so every past value stays in the audit trail; the
// leaderboard views already pick the latest row per lane/workout.
export async function correctScore(formData: FormData) {
  const { supabase } = await requirePrivileged();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const heatAssignmentId = String(formData.get("heatAssignmentId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  const workoutRefId = String(formData.get("workoutRefId") ?? "") || null;
  const scoringType = String(formData.get("scoringType") ?? "time");
  const rawValue = String(formData.get("value") ?? "").trim();
  if (!heatAssignmentId || !workoutId || !rawValue || !user) return;

  let valueRaw: Record<string, unknown>;
  if (scoringType === "time") {
    const seconds = parseTime(rawValue);
    if (seconds == null) return;
    valueRaw = { time_seconds: seconds };
  } else if (scoringType === "reps") {
    valueRaw = { reps: Number(rawValue) };
  } else {
    valueRaw = { load_kg: Number(rawValue) };
  }

  const { error } = await supabase.from("scores").insert({
    heat_assignment_id: heatAssignmentId,
    workout_id: workoutId,
    workout_ref_id: workoutRefId,
    value_raw: valueRaw,
    submitted_by: user.id,
    client_submission_id: crypto.randomUUID(),
  });
  if (error) throw error;

  revalidatePath(`/events/${eventId}/divisions/${divisionId}/heats`);
}

// Deletes a single score row outright — for the case where a lane was
// scored entirely by mistake (wrong athlete, test entry) rather than
// just entered wrong, where a correcting insert wouldn't remove
// anything. RLS (scores_privileged_all) is the real gate here; this
// action's requirePrivileged() call matches it, not enforces it twice.
export async function deleteScore(formData: FormData) {
  const { supabase } = await requirePrivileged();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const scoreId = String(formData.get("scoreId") ?? "");
  if (!scoreId) return;

  const { error } = await supabase.from("scores").delete().eq("id", scoreId);
  if (error) throw error;

  revalidatePath(`/events/${eventId}/divisions/${divisionId}/heats`);
}
