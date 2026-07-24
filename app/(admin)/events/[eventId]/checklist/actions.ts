"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";

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

export async function updatePaymentProvider(formData: FormData) {
  const supabase = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const paymentProvider = String(formData.get("paymentProvider") ?? "");
  if (!eventId || !["yoco", "payfast"].includes(paymentProvider)) return;

  await supabase.from("events").update({ payment_provider: paymentProvider }).eq("id", eventId);
  revalidatePath(`/events/${eventId}/checklist`);
}
