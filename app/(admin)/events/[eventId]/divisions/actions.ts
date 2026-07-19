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
  });
  revalidatePath(`/events/${eventId}/divisions`);
}
