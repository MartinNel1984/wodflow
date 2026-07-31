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
