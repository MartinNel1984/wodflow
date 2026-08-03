"use server";

import { requireOrganizer } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addNotice(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!eventId || !title || !body) return;

  await supabase.from("notices").insert({
    event_id: eventId,
    organization_id: organizationId,
    title,
    body,
  });
  revalidatePath(`/events/${eventId}/notices`);
}

export async function removeNotice(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("notices").delete().eq("id", id);
  revalidatePath(`/events/${eventId}/notices`);
}
