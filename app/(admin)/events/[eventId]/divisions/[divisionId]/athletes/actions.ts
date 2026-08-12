"use server";

import { requireOrganizer } from "@/lib/auth";
import { sendPaymentReminderEmail, sendRegistrationEmails } from "@/lib/email";
import { revalidatePath } from "next/cache";

function path(eventId: string, divisionId: string) {
  return `/events/${eventId}/divisions/${divisionId}/athletes`;
}

// Walk-up/manual registration — an organizer adding someone who never
// went through the public wizard (e.g. a late walk-up entry). Marked
// payment_status 'waived' since no checkout happened. Email is required
// by registration_athletes for the future invite/portal flow, so a
// placeholder is generated when the organizer doesn't have one on hand.
//
// Team divisions (team_size > 1) are detected by the presence of a
// `teamName` field — the per-division Athletes page sends it and one
// repeated `athleteName` field per teammate; the cross-event Athletes
// directory's form never sends `teamName`, so it stays on the original
// single-athlete path unchanged.
export async function addAthleteManually(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const divisionId = String(formData.get("divisionId") ?? "");
  if (!divisionId) return;

  // Looked up server-side rather than trusted from a hidden eventId field
  // — this action is now called from both the per-division Athletes page
  // and the cross-event Athletes directory, and the division is always
  // the single source of truth for which event a registration belongs to.
  const { data: division } = await supabase.from("divisions").select("event_id").eq("id", divisionId).single();
  if (!division) return;

  const teamName = String(formData.get("teamName") ?? "").trim();

  if (teamName) {
    const athleteNames = formData
      .getAll("athleteName")
      .map((v) => String(v).trim())
      .filter(Boolean);
    if (athleteNames.length === 0) return;

    const { data: registration, error } = await supabase
      .from("registrations")
      .insert({
        event_id: division.event_id,
        division_id: divisionId,
        team_name: teamName,
        payment_status: "waived",
      })
      .select("id")
      .single();
    if (error || !registration) return;

    await supabase.from("registration_athletes").insert(
      athleteNames.map((fullName, i) => ({
        registration_id: registration.id,
        full_name: fullName,
        email: `manual+${registration.id}+${i}@wodflow.local`,
        is_captain: i === 0,
      }))
    );
  } else {
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const idNumber = String(formData.get("idNumber") ?? "").trim();
    if (!fullName) return;

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
  }

  revalidatePath(path(division.event_id, divisionId));
  revalidatePath("/athletes");
}

// For a registration stuck at 'pending' (abandoned checkout) — emails
// the captain the same PayFast link already generated at signup, so
// they can finish paying without re-entering their whole registration.
export async function resendPaymentLink(formData: FormData): Promise<{ sent: boolean }> {
  const { supabase } = await requireOrganizer();
  const registrationId = String(formData.get("registrationId") ?? "");
  if (!registrationId) return { sent: false };

  // RLS (org-scoped via requireOrganizer's session client) returns
  // nothing if this registration belongs to a different organizer.
  const { data: registration } = await supabase
    .from("registrations")
    .select("id, payment_status")
    .eq("id", registrationId)
    .single();
  if (!registration || registration.payment_status !== "pending") return { sent: false };

  const sent = await sendPaymentReminderEmail(registrationId);
  return { sent };
}

// Manual reconciliation for a registration whose PayFast payment actually
// went through (organizer sees the money land in PayFast/their bank) but
// never flipped to 'paid' here — PayFast's ITN webhook is server-to-server
// and delivery isn't guaranteed, so this UI is the fallback when it's lost.
// Mirrors the webhook's own update + email exactly, so it's a normal
// "resend confirmation" no-op if triggered again on an already-paid row.
export async function markPaidAndSendConfirmation(formData: FormData): Promise<{ sent: boolean }> {
  const { supabase } = await requireOrganizer();
  const registrationId = String(formData.get("registrationId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  if (!registrationId) return { sent: false };

  const { data: registration } = await supabase
    .from("registrations")
    .select("id, payment_status")
    .eq("id", registrationId)
    .single();
  if (!registration) return { sent: false };

  if (registration.payment_status !== "paid") {
    await supabase
      .from("registrations")
      .update({ payment_status: "paid", paid_at: new Date().toISOString(), paid_via: "manual" })
      .eq("id", registrationId)
      .neq("payment_status", "paid");
  }

  await sendRegistrationEmails(registrationId);

  if (eventId && divisionId) revalidatePath(path(eventId, divisionId));
  revalidatePath("/athletes");
  return { sent: true };
}

// Renames a team registration's team_name. Also used to fill in a blank
// team_name left over from a registration that never had one set.
export async function updateTeamName(formData: FormData): Promise<{ success: boolean }> {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  const teamName = String(formData.get("teamName") ?? "").trim();
  if (!registrationId || !teamName) return { success: false };

  const { error } = await supabase
    .from("registrations")
    .update({ team_name: teamName })
    .eq("id", registrationId);
  if (error) return { success: false };

  if (eventId && divisionId) revalidatePath(path(eventId, divisionId));
  revalidatePath("/athletes");
  return { success: true };
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
