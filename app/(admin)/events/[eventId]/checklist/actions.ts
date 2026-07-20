"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireOrganizer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "organizer") throw new Error("Not authorised");
  return supabase;
}

export async function updateWaiverText(formData: FormData) {
  const supabase = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const waiverText = String(formData.get("waiverText") ?? "").trim();
  if (!eventId) return;

  await supabase.from("events").update({ waiver_text: waiverText || null }).eq("id", eventId);
  revalidatePath(`/events/${eventId}/checklist`);
}

export async function updateJudgingMode(formData: FormData) {
  const supabase = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const judgingMode = String(formData.get("judgingMode") ?? "");
  if (!eventId || !["centralized", "distributed"].includes(judgingMode)) return;

  await supabase.from("events").update({ judging_mode: judgingMode }).eq("id", eventId);
  revalidatePath(`/events/${eventId}/checklist`);
}
