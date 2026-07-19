"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateHeats, type RosterEntry } from "@/lib/heats";

async function requireOrganizer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "organizer") throw new Error("Not authorised");
  return supabase;
}

// Whole-division regeneration. Only ever touches heats/assignments in
// 'scheduled' status — heats already 'in_progress' or 'completed' are
// left untouched, so re-running this mid-event can't wipe a division
// that's already underway.
export async function generateHeatsForDivision(formData: FormData) {
  const supabase = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const laneCount = Number(formData.get("laneCount"));
  const heatDurationMinutes = Number(formData.get("heatDurationMinutes"));
  const transitionMinutes = Number(formData.get("transitionMinutes") ?? 0);
  const startTimeRaw = String(formData.get("startTime") ?? "");
  if (!eventId || !divisionId || !laneCount || !heatDurationMinutes || !startTimeRaw) return;

  const startTime = new Date(startTimeRaw);

  const { data: registrations, error: regError } = await supabase
    .from("registrations")
    .select("id, registration_order")
    .eq("division_id", divisionId)
    .in("payment_status", ["paid", "waived"])
    .order("registration_order", { ascending: true });
  if (regError) throw regError;

  const roster: RosterEntry[] = (registrations ?? []).map((r) => ({
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
  const { data: scheduledHeats } = await supabase
    .from("heats")
    .select("id")
    .eq("division_id", divisionId)
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
  const supabase = await requireOrganizer();
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
  if (error) throw error;

  revalidatePath(`/events/${eventId}/divisions/${divisionId}/heats`);
}
