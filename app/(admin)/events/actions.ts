"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// brand_kits are readable platform-wide (public event pages need to
// render any org's kit), so nothing stops an organizer from picking
// another org's brand_kit_id off the "New event"/"Edit brand kit"
// dropdown unless the write path itself checks ownership — verify it
// belongs to the caller's own org before ever attaching it to an event.
async function ownedBrandKitId(
  supabase: Awaited<ReturnType<typeof requireOrganizer>>["supabase"],
  organizationId: string,
  rawBrandKitId: string
): Promise<string | null> {
  if (!rawBrandKitId) return null;
  const { data: kit } = await supabase
    .from("brand_kits")
    .select("id, organization_id")
    .eq("id", rawBrandKitId)
    .single();
  return kit?.organization_id === organizationId ? rawBrandKitId : null;
}

export async function createEvent(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  if (!name || !startDate) return;

  const defaultPrice = Number(formData.get("defaultPrice"));
  const brandKitId = await ownedBrandKitId(
    supabase,
    organizationId,
    String(formData.get("brandKitId") ?? "").trim()
  );

  await supabase.from("events").insert({
    name,
    slug: slugify(name),
    start_date: startDate,
    end_date: String(formData.get("endDate") ?? "").trim() || null,
    venue_name: String(formData.get("venueName") ?? "").trim() || null,
    venue_address: String(formData.get("venueAddress") ?? "").trim() || null,
    contact_email: String(formData.get("contactEmail") ?? "").trim() || null,
    contact_phone: String(formData.get("contactPhone") ?? "").trim() || null,
    waiver_text: String(formData.get("waiverText") ?? "").trim() || null,
    default_price: Number.isNaN(defaultPrice) ? 500 : defaultPrice,
    brand_kit_id: brandKitId,
    organization_id: organizationId,
  });
  revalidatePath("/events");
}

export async function updateEventStatus(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["draft", "published", "live", "archived"].includes(status)) return;

  await supabase.from("events").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/events");
}

export async function updateEventBrandKit(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const brandKitId = await ownedBrandKitId(
    supabase,
    organizationId,
    String(formData.get("brandKitId") ?? "").trim()
  );

  await supabase.from("events").update({ brand_kit_id: brandKitId, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/events");
}
