"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createBrandKit(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("brand_kits").insert({
    name,
    logo_url: String(formData.get("logoUrl") ?? "").trim() || null,
    color_primary: String(formData.get("colorPrimary") ?? "").trim() || null,
    color_secondary: String(formData.get("colorSecondary") ?? "").trim() || null,
    color_accent: String(formData.get("colorAccent") ?? "").trim() || null,
    tagline: String(formData.get("tagline") ?? "").trim() || null,
    organization_id: organizationId,
  });
  revalidatePath("/brand-kits");
}

export async function deleteBrandKit(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabase.from("brand_kits").delete().eq("id", id);
  if (error) {
    // events.brand_kit_id has no cascade — a kit still assigned to an
    // event fails to delete at the DB level (23503). Surface that
    // instead of silently discarding the error and looking like it worked.
    redirect(
      `/brand-kits?error=${encodeURIComponent(
        "Could not delete brand kit — it's still assigned to an event. Unassign it first."
      )}`
    );
  }
  revalidatePath("/brand-kits");
  redirect("/brand-kits");
}
