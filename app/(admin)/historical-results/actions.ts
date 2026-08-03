"use server";

import { requireOrganizer } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addHistoricalResult(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();

  const eventName = String(formData.get("eventName") ?? "").trim();
  const divisionName = String(formData.get("divisionName") ?? "").trim();
  const teamName = String(formData.get("teamName") ?? "").trim();
  const athleteName = String(formData.get("athleteName") ?? "").trim();
  const athleteEmail = String(formData.get("athleteEmail") ?? "").trim().toLowerCase();
  const position = Number(formData.get("position"));
  const entrants = Number(formData.get("entrants"));
  const gender = String(formData.get("gender") ?? "").trim() || null;
  const seasonTierRaw = formData.get("seasonTier");
  const seasonTier = seasonTierRaw ? Number(seasonTierRaw) : null;

  if (!eventName || !divisionName || !athleteName || !athleteEmail) return;
  if (!Number.isInteger(position) || position < 1) return;
  if (!Number.isInteger(entrants) || entrants < 1) return;

  await supabase.from("historical_results").insert({
    organization_id: organizationId,
    event_name: eventName,
    division_name: divisionName,
    team_name: teamName || null,
    athlete_name: athleteName,
    athlete_email: athleteEmail,
    position,
    entrants,
    gender,
    season_tier: seasonTier,
  });

  revalidatePath("/historical-results");
}

// Athletes sometimes register under two different emails across events
// (e.g. bev.mpofu5@gmail.com at Indy, bev.mpofu@outlook.com at Remix) —
// public_historical_placements keys unmatched rows by athlete_email, so
// two different emails for the same person show up as two separate
// entries on the season leaderboard. Retyping one row's email to match
// the other merges them into a single ranked identity on the next read.
export async function updateHistoricalResultEmail(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  const athleteEmail = String(formData.get("athleteEmail") ?? "").trim().toLowerCase();
  if (!id || !athleteEmail) return;
  await supabase.from("historical_results").update({ athlete_email: athleteEmail }).eq("id", id);
  revalidatePath("/historical-results");
}

export async function removeHistoricalResult(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("historical_results").delete().eq("id", id);
  revalidatePath("/historical-results");
}
