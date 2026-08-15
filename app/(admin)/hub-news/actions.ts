"use server";

import { requireOrganizer } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addHubNews(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await supabase.from("hub_news").insert({
    title,
    body: String(formData.get("body") ?? "").trim() || null,
    organization_id: organizationId,
  });
  revalidatePath("/hub-news");
  revalidatePath("/");
}

export async function deleteHubNews(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("hub_news").delete().eq("id", id);
  revalidatePath("/hub-news");
  revalidatePath("/");
}
