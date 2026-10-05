"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";

export async function createSeries(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const name = String(formData.get("name") ?? "").trim();
  const year = Number(formData.get("year"));
  if (!name || Number.isNaN(year)) return;

  await supabase.from("series").insert({ name, year, organization_id: organizationId });
  revalidatePath("/series");
}

export async function addSeriesEvent(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const seriesId = String(formData.get("seriesId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  if (!seriesId || !eventId) return;

  // series_events' RLS only verifies the caller owns the SERIES, not
  // that the event being linked belongs to the same org — without this
  // check here, any organizer could add another org's event to their
  // own series, pulling that org's athlete names/results onto their
  // public season standings. The events table itself is properly
  // org-scoped, so this is the only place that needed the extra check.
  const { data: event } = await supabase.from("events").select("organization_id").eq("id", eventId).single();
  if (event?.organization_id !== organizationId) return;

  const { count } = await supabase
    .from("series_events")
    .select("id", { count: "exact", head: true })
    .eq("series_id", seriesId);

  await supabase
    .from("series_events")
    .upsert({ series_id: seriesId, event_id: eventId, sequence: (count ?? 0) + 1 }, { onConflict: "series_id,event_id" });
  revalidatePath(`/series/${seriesId}`);
}

export async function removeSeriesEvent(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const seriesId = String(formData.get("seriesId") ?? "");
  const seriesEventId = String(formData.get("seriesEventId") ?? "");
  if (!seriesEventId) return;

  await supabase.from("series_events").delete().eq("id", seriesEventId);
  revalidatePath(`/series/${seriesId}`);
}

// Community Cup config lives on the series row itself (migration-091).
// Flipping enabled=true publishes the /rumble-series/[id]/community-cup
// page; the min-athletes threshold controls when a gym becomes visible
// on that public page (admin page always shows all gyms).
export async function updateCommunityCupConfig(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const seriesId = String(formData.get("seriesId") ?? "");
  if (!seriesId) return;
  const enabled = formData.get("enabled") === "on";
  const rawMin = Number(formData.get("minAthletes"));
  const minAthletes = Number.isFinite(rawMin) && rawMin > 0 ? Math.floor(rawMin) : 5;

  await supabase
    .from("series")
    .update({ community_cup_enabled: enabled, community_cup_min_athletes: minAthletes })
    .eq("id", seriesId);
  revalidatePath(`/series/${seriesId}`);
  revalidatePath(`/series/${seriesId}/community-cup`);
  revalidatePath(`/rumble-series/${seriesId}/community-cup`);
}
