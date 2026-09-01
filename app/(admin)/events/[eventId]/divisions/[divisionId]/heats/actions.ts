"use server";

import { requireOrganizer, requirePrivileged } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { buildHeatSchedule, assignRosterToHeats, type RosterEntry } from "@/lib/heats";
import { parseTime } from "@/lib/scoring";
import { validateScoreValue } from "@/lib/scoreValidation";
import { computeStandings, type LeaderboardRow, type ScoringConfig } from "@/lib/leaderboard";

// Registrations still needing a heat slot for this workout: paid/waived,
// minus anyone already locked into an in-progress/completed heat. Shared
// by both the schedule step and the fill step so they always agree on
// who needs placing — without this exclusion an athlete already scored
// in a completed heat would get a second assignment in a freshly
// generated one, and computeWorkoutResults/computeStandings would then
// rank and count them twice, silently corrupting the leaderboard.
async function unplacedRegistrations(
  supabase: Awaited<ReturnType<typeof requireOrganizer>>["supabase"],
  divisionId: string,
  workoutId: string
) {
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

  return registrations.filter((r) => !alreadyAssignedIds.has(r.id));
}

// Step 1 (Tjokkie, 2026-09-01): blank heat slots — timing only, no teams
// — so athletes can see roughly when they'll compete before seeding is
// decided. Only ever touches heats in 'scheduled' status — heats already
// 'in_progress' or 'completed' are left untouched, so re-running this
// mid-event can't wipe a workout that's already underway. Regenerating
// the schedule clears any teams already filled into it (step 2 needs
// re-running after), since a changed heat count/timing invalidates the
// old lane assignments.
export async function generateHeatSchedule(formData: FormData) {
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

  const registrations = await unplacedRegistrations(supabase, divisionId, workoutId);
  const heats = buildHeatSchedule({
    laneCount,
    heatDurationMinutes,
    transitionMinutes,
    startTime,
    rosterSize: registrations.length,
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

  const { error: heatsError } = await supabase.from("heats").insert(
    heats.map((h) => ({
      event_id: eventId,
      division_id: divisionId,
      workout_id: workoutId,
      heat_number: h.heatNumber,
      start_time: h.startTime.toISOString(),
      end_time: h.endTime.toISOString(),
    }))
  );
  if (heatsError) throw heatsError;

  revalidatePath(`/events/${eventId}/divisions/${divisionId}/heats`);
}

// Step 2 (Tjokkie, 2026-09-01): fills teams into an already-generated
// blank schedule, seeded by standings or registration order. Never
// creates or resizes heats — run generateHeatSchedule first (or again,
// if the roster's changed since). Only replaces assignments in
// 'scheduled' heats, same in-progress/completed protection as the
// schedule step.
export async function fillHeats(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  if (!eventId || !divisionId || !workoutId) {
    throw new Error("Missing required fields — workout is required.");
  }

  const { data: workout, error: workoutError } = await supabase
    .from("workouts")
    .select("lane_count, sequence")
    .eq("id", workoutId)
    .single();
  if (workoutError) throw workoutError;
  const laneCount = workout?.lane_count;
  if (!laneCount) {
    throw new Error("This workout has no lane count set — set it before filling heats.");
  }

  const { data: scheduledHeats, error: scheduledError } = await supabase
    .from("heats")
    .select("id, heat_number")
    .eq("workout_id", workoutId)
    .eq("status", "scheduled")
    .order("heat_number", { ascending: true });
  if (scheduledError) throw scheduledError;
  if (!scheduledHeats || scheduledHeats.length === 0) {
    throw new Error("No heat schedule yet for this workout — generate the heat schedule first.");
  }

  const registrations = await unplacedRegistrations(supabase, divisionId, workoutId);

  // ---- Re-seeding by prior standings -------------------------------
  // lib/heats.ts has always supported seedRank (worst-seed-first, so the
  // strongest athletes land in the final heat — standard competition
  // convention), but nothing ever populated it: every workout's heats
  // were generated in registration order. For a multi-WOD event that
  // means identical heat composition all weekend.
  //
  // Ranks come from computeStandings over every workout in this division
  // with a LOWER sequence than the one being generated — i.e. cumulative
  // standings going into this workout, not just the previous WOD's
  // result. Reusing the leaderboard's own function (rather than a
  // parallel ranking) means heat seeding and the public leaderboard can
  // never disagree about who's winning.
  //
  // Workout 1 has no prior workouts, so this no-ops and behaviour is
  // unchanged there. "registration" mode is the organizer's manual
  // override for when they want registration order regardless.
  const seedMode = String(formData.get("seedMode") ?? "standings");
  const seedRankByRegistration = new Map<string, number>();

  if (seedMode === "standings" && workout?.sequence != null) {
    const { data: priorWorkouts } = await supabase
      .from("workouts")
      .select("id")
      .eq("division_id", divisionId)
      .lt("sequence", workout.sequence);

    const priorIds = new Set((priorWorkouts ?? []).map((w) => w.id as string));
    if (priorIds.size > 0) {
      const [{ data: division }, { data: rows }] = await Promise.all([
        supabase.from("divisions").select("scoring_config").eq("id", divisionId).single(),
        supabase
          .from("public_leaderboard")
          .select(
            "heat_assignment_id, workout_id, value_raw, registration_id, display_name, tiebreak_value, workout_name, workout_scoring_config"
          )
          .eq("division_id", divisionId),
      ]);

      // public_leaderboard.workout_id is coalesce(workout_ref_id::text,
      // legacy text label) per migration-042, so comparing against
      // workouts.id as text is the correct join for any modern score.
      const priorRows = ((rows ?? []) as LeaderboardRow[]).filter((r) => priorIds.has(r.workout_id));

      if (priorRows.length > 0) {
        const scoringConfig = (division?.scoring_config ?? { method: "rank_sum" }) as ScoringConfig;
        const { standings } = computeStandings(priorRows, scoringConfig);
        // standings is sorted best-first, so index 0 is rank 1.
        standings.forEach((s, i) => seedRankByRegistration.set(s.registrationId, i + 1));
      }
    }
  }

  const roster: RosterEntry[] = registrations.map((r) => ({
    registrationId: r.id,
    registrationOrder: r.registration_order,
    // null for anyone with no prior score (a late entry joining at WOD
    // 3, say) — orderRoster puts unseeded athletes in the earliest
    // heats, which is the right place for them.
    seedRank: seedRankByRegistration.get(r.id) ?? null,
  }));

  const assignments = assignRosterToHeats({
    laneCount,
    roster,
    heatNumbers: scheduledHeats.map((h) => h.heat_number),
  });

  const scheduledHeatIds = scheduledHeats.map((h) => h.id);
  await supabase.from("heat_assignments").delete().in("heat_id", scheduledHeatIds);

  const heatIdByNumber = new Map(scheduledHeats.map((h) => [h.heat_number, h.id]));
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

  // Same validator the /api/scores path uses — a correction typed as
  // "-5" or "abc" would otherwise land straight in the leaderboard.
  const valueError = validateScoreValue(valueRaw);
  if (valueError) throw new Error(valueError);

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
