"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireOrganizer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "organizer") throw new Error("Not authorised");
  return supabase;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createEvent(formData: FormData) {
  const supabase = await requireOrganizer();
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  if (!name || !startDate) return;

  const defaultPrice = Number(formData.get("defaultPrice"));

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
  });
  revalidatePath("/events");
}

export async function updateEventStatus(formData: FormData) {
  const supabase = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["draft", "published", "live", "archived"].includes(status)) return;

  await supabase.from("events").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/events");
}
