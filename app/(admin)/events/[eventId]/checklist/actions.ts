"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";

export async function updateWaiverText(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const waiverText = String(formData.get("waiverText") ?? "").trim();
  if (!eventId) return;

  await supabase.from("events").update({ waiver_text: waiverText || null }).eq("id", eventId);
  revalidatePath(`/events/${eventId}/checklist`);
}

export async function updateJudgingMode(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const judgingMode = String(formData.get("judgingMode") ?? "");
  if (!eventId || !["centralized", "distributed"].includes(judgingMode)) return;

  await supabase.from("events").update({ judging_mode: judgingMode }).eq("id", eventId);
  revalidatePath(`/events/${eventId}/checklist`);
}

export async function updateEventContactInfo(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return;

  const trimmed = (key: string) => String(formData.get(key) ?? "").trim() || null;
  // Unlike the other fields here, name isn't optional — an event with
  // no name would break every page that displays it.
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase
    .from("events")
    .update({
      name,
      venue_name: trimmed("venueName"),
      venue_address: trimmed("venueAddress"),
      contact_email: trimmed("contactEmail"),
      contact_phone: trimmed("contactPhone"),
    })
    .eq("id", eventId);
  revalidatePath(`/events/${eventId}/checklist`);
}

export async function updateTicketPrices(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return;

  // Blank = spectator tickets are disabled for this event — no forced
  // default (design doc's "opt-in per event" decision), so an empty
  // field must write null, not 0 or an omitted update.
  const parsePrice = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  // Blank capacity = unlimited, same convention as a blank price meaning
  // "tickets off" — an empty field must write null, not 0 (which would
  // read as "sold out" to the enforce_spectator_capacity trigger).
  const parseCapacity = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    const n = Number(raw);
    return raw && Number.isInteger(n) && n > 0 ? n : null;
  };

  await supabase
    .from("events")
    .update({
      spectator_price: parsePrice("spectatorPrice"),
      spectator_capacity: parseCapacity("spectatorCapacity"),
      weekend_pass_price: parsePrice("weekendPassPrice"),
      weekend_pass_capacity: parseCapacity("weekendPassCapacity"),
    })
    .eq("id", eventId);
  revalidatePath(`/events/${eventId}/checklist`);
}

export async function updateEventDetails(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const posterUrl = String(formData.get("posterUrl") ?? "").trim();
  if (!eventId) return;

  await supabase
    .from("events")
    .update({ description: description || null, poster_url: posterUrl || null })
    .eq("id", eventId);
  revalidatePath(`/events/${eventId}/checklist`);
}

