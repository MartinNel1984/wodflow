"use server";

import { requireOrganizer } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function path(eventId: string, divisionId: string) {
  return `/events/${eventId}/divisions/${divisionId}/athletes`;
}

// Walk-up/manual registration — an organizer adding someone who never
// went through the public wizard (e.g. a late walk-up entry). Marked
// payment_status 'waived' since no checkout happened. Email is required
// by registration_athletes for the future invite/portal flow, so a
// placeholder is generated when the organizer doesn't have one on hand.
export async function addAthleteManually(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const divisionId = String(formData.get("divisionId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const idNumber = String(formData.get("idNumber") ?? "").trim();
  if (!divisionId || !fullName) return;

  // Looked up server-side rather than trusted from a hidden eventId field
  // — this action is now called from both the per-division Athletes page
  // and the cross-event Athletes directory, and the division is always
  // the single source of truth for which event a registration belongs to.
  const { data: division } = await supabase.from("divisions").select("event_id").eq("id", divisionId).single();
  if (!division) return;

  const { data: registration, error } = await supabase
    .from("registrations")
    .insert({
      event_id: division.event_id,
      division_id: divisionId,
      payment_status: "waived",
    })
    .select("id")
    .single();
  if (error || !registration) return;

  await supabase.from("registration_athletes").insert({
    registration_id: registration.id,
    full_name: fullName,
    email: email || `manual+${registration.id}@wodflow.local`,
    id_number: idNumber || null,
    is_captain: true,
  });

  revalidatePath(path(division.event_id, divisionId));
  revalidatePath("/athletes");
}

// Removes a single athlete row. If they were the last person on their
// registration, the (now-empty) registration is removed too, so a manual
// remove doesn't leave an orphan "team of zero" behind.
export async function removeAthlete(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const athleteId = String(formData.get("athleteId") ?? "");
  if (!athleteId) return;

  const { data: athlete } = await supabase
    .from("registration_athletes")
    .select("registration_id")
    .eq("id", athleteId)
    .single();
  if (!athlete) return;

  await supabase.from("registration_athletes").delete().eq("id", athleteId);

  const { count } = await supabase
    .from("registration_athletes")
    .select("id", { count: "exact", head: true })
    .eq("registration_id", athlete.registration_id);
  if (!count) {
    await supabase.from("registrations").delete().eq("id", athlete.registration_id);
  }

  if (eventId && divisionId) revalidatePath(path(eventId, divisionId));
  revalidatePath("/athletes");
}
