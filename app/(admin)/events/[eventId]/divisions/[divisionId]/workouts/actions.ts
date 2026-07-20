"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

function path(eventId: string, divisionId: string) {
  return `/events/${eventId}/divisions/${divisionId}/workouts`;
}

export async function createWorkout(formData: FormData) {
  const supabase = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!eventId || !divisionId || !name) return;

  const capMinutes = Number(formData.get("capMinutes"));
  const sequence = Number(formData.get("sequence"));

  await supabase.from("workouts").insert({
    division_id: divisionId,
    name,
    sequence: Number.isNaN(sequence) ? 1 : sequence,
    cap_seconds: Number.isNaN(capMinutes) ? null : Math.round(capMinutes * 60),
    scoring_type: String(formData.get("scoringType") ?? "time"),
    tiebreak_enabled: formData.get("tiebreakEnabled") === "on",
  });
  revalidatePath(path(eventId, divisionId));
}

export async function deleteWorkout(formData: FormData) {
  const supabase = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  if (!workoutId) return;

  await supabase.from("workouts").delete().eq("id", workoutId);
  revalidatePath(path(eventId, divisionId));
}

export async function addMovement(formData: FormData) {
  const supabase = await requireOrganizer();
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
    reps_rx: num("repsRx"),
    reps_scaled: num("repsScaled"),
    load_rx: String(formData.get("loadRx") ?? "").trim() || null,
    load_scaled: String(formData.get("loadScaled") ?? "").trim() || null,
    rounds: Number.isNaN(rounds) || rounds < 1 ? 1 : rounds,
  });
  revalidatePath(path(eventId, divisionId));
}

export async function deleteMovement(formData: FormData) {
  const supabase = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const movementId = String(formData.get("movementId") ?? "");
  if (!movementId) return;

  await supabase.from("workout_movements").delete().eq("id", movementId);
  revalidatePath(path(eventId, divisionId));
}
