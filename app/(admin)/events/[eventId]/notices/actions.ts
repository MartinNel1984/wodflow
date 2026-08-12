"use server";

import { requireOrganizer } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addNotice(_prevState: { error: string | null }, formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const orgWide = formData.get("orgWide") === "on";
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!eventId || !title || !body) return { error: "Title and message are required." };

  const { error } = await supabase.from("notices").insert({
    // Box-wide notices aren't pinned to one event, so every athlete
    // who's ever registered with the org sees them (migration-063).
    event_id: orgWide ? null : eventId,
    organization_id: organizationId,
    title,
    body,
  });
  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}/notices`);
  revalidatePath("/portal");
  revalidatePath("/notice-board");
  return { error: null };
}

export async function removeNotice(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("notices").delete().eq("id", id);
  revalidatePath(`/events/${eventId}/notices`);
}
