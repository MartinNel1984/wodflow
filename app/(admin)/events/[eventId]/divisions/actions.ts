"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";

export async function createDivision(formData: FormData) {
  const supabase = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const priceNormal = Number(formData.get("priceNormal"));
  if (!eventId || !name || Number.isNaN(priceNormal)) return;

  const num = (key: string) => {
    const v = formData.get(key);
    if (!v) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const scoringMethod = String(formData.get("scoringMethod") ?? "rank_sum");

  await supabase.from("divisions").insert({
    event_id: eventId,
    name,
    team_size: num("teamSize") ?? 1,
    price_early: num("priceEarly"),
    price_normal: priceNormal,
    price_late: num("priceLate"),
    early_bird_ends: String(formData.get("earlyBirdEnds") ?? "").trim() || null,
    late_starts: String(formData.get("lateStarts") ?? "").trim() || null,
    lane_count: num("laneCount"),
    heat_duration_minutes: num("heatDurationMinutes"),
    transition_minutes: num("transitionMinutes"),
    workout_scoring_type: String(formData.get("workoutScoringType") ?? "time"),
    scoring_config: { method: scoringMethod },
  });
  revalidatePath(`/events/${eventId}/divisions`);
}

export async function updateScoringConfig(formData: FormData) {
  const supabase = await requireOrganizer();
  const eventId = String(formData.get("eventId") ?? "");
  const divisionId = String(formData.get("divisionId") ?? "");
  const scoringMethod = String(formData.get("scoringMethod") ?? "");
  if (!divisionId || !["rank_sum", "gap_formula"].includes(scoringMethod)) return;

  await supabase.from("divisions").update({ scoring_config: { method: scoringMethod } }).eq("id", divisionId);
  revalidatePath(`/events/${eventId}/divisions`);
}
