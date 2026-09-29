"use server";

import { requirePrivileged } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// requirePrivileged is a soft check for a clean error message — heats_write
// RLS (organizer OR head_judge, migration-016) is the real boundary a judge
// can't bypass by calling this directly.
export async function setHeatStatus(formData: FormData) {
  const { supabase } = await requirePrivileged();
  const heatId = String(formData.get("heatId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!heatId || !["in_progress", "completed"].includes(status)) return;

  await supabase.from("heats").update({ status }).eq("id", heatId);
  revalidatePath("/score");
}

// Tjokkie, 2026-09-29: "clear all scores option once in a heat if I made
// an error" — a real DELETE, not another append-only correction row
// (that pattern is for fixing one lane's value while keeping the
// history; this is "wrong heat entirely, wipe it and start over").
// Scoped by heat_assignment_id, which already belongs to exactly one
// heat, so this can't touch another heat's scores even if the same
// team competes in this division's other workouts.
export async function clearHeatScores(formData: FormData) {
  const { supabase } = await requirePrivileged();
  const heatId = String(formData.get("heatId") ?? "");
  if (!heatId) return;

  const { data: assignments } = await supabase
    .from("heat_assignments")
    .select("id")
    .eq("heat_id", heatId);
  const heatAssignmentIds = (assignments ?? []).map((a) => a.id);
  if (heatAssignmentIds.length === 0) return;

  await supabase.from("scores").delete().in("heat_assignment_id", heatAssignmentIds);
  revalidatePath("/score");
}
