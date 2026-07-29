"use server";

import { requireOrganizer } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addHubPhoto(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  if (!imageUrl) return;

  const { data: existing } = await supabase
    .from("hub_photos")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (existing?.sort_order ?? 0) + 1;

  await supabase.from("hub_photos").insert({
    image_url: imageUrl,
    caption: String(formData.get("caption") ?? "").trim() || null,
    sort_order: nextSortOrder,
    organization_id: organizationId,
  });
  revalidatePath("/hub-photos");
  revalidatePath("/");
}

export async function deleteHubPhoto(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("hub_photos").delete().eq("id", id);
  revalidatePath("/hub-photos");
  revalidatePath("/");
}
