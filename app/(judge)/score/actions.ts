"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Soft check for a clean error message — heats_write RLS (organizer OR
// head_judge, migration-016) is the real boundary a judge can't bypass
// by calling this directly.
async function requirePrivileged() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "organizer" && profile?.role !== "head_judge") {
    throw new Error("Only the organizer or head judge can lock a heat");
  }
  return supabase;
}

export async function setHeatStatus(formData: FormData) {
  const supabase = await requirePrivileged();
  const heatId = String(formData.get("heatId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!heatId || !["in_progress", "completed"].includes(status)) return;

  await supabase.from("heats").update({ status }).eq("id", heatId);
  revalidatePath("/score");
}
