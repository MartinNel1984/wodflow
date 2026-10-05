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

  const taggedEvent = String(formData.get("taggedEvent") ?? "").trim();
  const [taggedType, taggedId] = taggedEvent.split(":");
  const contentHash = String(formData.get("contentHash") ?? "").trim() || null;

  await supabase.from("hub_photos").insert({
    image_url: imageUrl,
    caption: String(formData.get("caption") ?? "").trim() || null,
    event_id: taggedType === "event" ? taggedId : null,
    historical_event_id: taggedType === "historical" ? taggedId : null,
    sort_order: nextSortOrder,
    organization_id: organizationId,
    content_hash: contentHash,
  });
  revalidatePath("/hub-photos");
  revalidatePath("/photos");
  revalidatePath("/");
}

export type BulkPhotoInput = {
  imageUrl: string;
  caption?: string | null;
  contentHash: string;
};

export type BulkPhotoResult = {
  inserted: number;
  duplicates: number;
  failed: { imageUrl: string; message: string }[];
};

// Batch insert path for the multi-file uploader. Each item has
// already been uploaded to Storage client-side; this just writes
// the rows. Rows that collide on (organization_id, content_hash)
// are skipped — the photographer's zip has repeats and Tjokkie
// does not want to see 10 copies of the podium shot.
export async function addHubPhotosBulk(
  taggedEvent: string,
  items: BulkPhotoInput[]
): Promise<BulkPhotoResult> {
  const { supabase, organizationId } = await requireOrganizer();
  const [taggedType, taggedId] = (taggedEvent ?? "").split(":");
  const eventId = taggedType === "event" ? taggedId : null;
  const historicalEventId = taggedType === "historical" ? taggedId : null;

  const { data: existing } = await supabase
    .from("hub_photos")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let sortOrder = (existing?.sort_order ?? 0) + 1;

  const result: BulkPhotoResult = { inserted: 0, duplicates: 0, failed: [] };

  for (const item of items) {
    const { error } = await supabase.from("hub_photos").insert({
      image_url: item.imageUrl,
      caption: item.caption?.trim() || null,
      event_id: eventId,
      historical_event_id: historicalEventId,
      sort_order: sortOrder,
      organization_id: organizationId,
      content_hash: item.contentHash,
    });
    if (error) {
      // 23505 = Postgres unique_violation; the content-hash
      // index above throws this for byte-identical re-uploads.
      if (error.code === "23505") {
        result.duplicates += 1;
      } else {
        result.failed.push({ imageUrl: item.imageUrl, message: error.message });
      }
      continue;
    }
    result.inserted += 1;
    sortOrder += 1;
  }

  if (result.inserted > 0) {
    revalidatePath("/hub-photos");
    revalidatePath("/photos");
    revalidatePath("/");
  }
  return result;
}

export async function deleteHubPhoto(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("hub_photos").delete().eq("id", id);
  revalidatePath("/hub-photos");
  revalidatePath("/photos");
  revalidatePath("/");
}
