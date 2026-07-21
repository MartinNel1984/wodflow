"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";

export async function createBrandKit(formData: FormData) {
  const supabase = await requireOrganizer();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("brand_kits").insert({
    name,
    logo_url: String(formData.get("logoUrl") ?? "").trim() || null,
    color_primary: String(formData.get("colorPrimary") ?? "").trim() || null,
    color_secondary: String(formData.get("colorSecondary") ?? "").trim() || null,
    color_accent: String(formData.get("colorAccent") ?? "").trim() || null,
    tagline: String(formData.get("tagline") ?? "").trim() || null,
  });
  revalidatePath("/brand-kits");
}

export async function deleteBrandKit(formData: FormData) {
  const supabase = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("brand_kits").delete().eq("id", id);
  revalidatePath("/brand-kits");
}
