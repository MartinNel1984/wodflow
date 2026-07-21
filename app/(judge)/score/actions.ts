"use server";

import { requirePrivileged } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// requirePrivileged is a soft check for a clean error message — heats_write
// RLS (organizer OR head_judge, migration-016) is the real boundary a judge
// can't bypass by calling this directly.
export async function setHeatStatus(formData: FormData) {
  const supabase = await requirePrivileged();
  const heatId = String(formData.get("heatId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!heatId || !["in_progress", "completed"].includes(status)) return;

  await supabase.from("heats").update({ status }).eq("id", heatId);
  revalidatePath("/score");
}
