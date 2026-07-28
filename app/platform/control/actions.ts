"use server";

import { requirePlatformAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createOrganization(formData: FormData) {
  const supabase = await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { error } = await supabase.from("organizations").insert({ name, slug: slugify(name) });
  if (error) throw error;

  revalidatePath("/platform/control");
}

export async function setOrganizationStatus(formData: FormData) {
  const supabase = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["active", "suspended"].includes(status)) return;

  const { error } = await supabase.from("organizations").update({ status }).eq("id", id);
  if (error) throw error;

  revalidatePath("/platform/control");
}

export async function createOrgInvite(formData: FormData) {
  const supabase = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "organizer");
  if (!organizationId || !email || !["organizer", "judge", "head_judge"].includes(role)) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("org_invites")
    .insert({ organization_id: organizationId, email, role, invited_by: user?.id });
  if (error) throw error;

  revalidatePath("/platform/control");
}
