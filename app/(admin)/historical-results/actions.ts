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
  });

  revalidatePath("/historical-results");
}

export async function removeHistoricalResult(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("historical_results").delete().eq("id", id);
  revalidatePath("/historical-results");
}
