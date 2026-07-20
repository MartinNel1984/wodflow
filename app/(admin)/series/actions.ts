"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireOrganizer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "organizer") throw new Error("Not authorised");
  return supabase;
}

export async function createSeries(formData: FormData) {
  const supabase = await requireOrganizer();
  const name = String(formData.get("name") ?? "").trim();
  const year = Number(formData.get("year"));
  if (!name || Number.isNaN(year)) return;

  await supabase.from("series").insert({ name, year });
  revalidatePath("/series");
}

export async function addSeriesEvent(formData: FormData) {
  const supabase = await requireOrganizer();
  const seriesId = String(formData.get("seriesId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  if (!seriesId || !eventId) return;

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
  const supabase = await requireOrganizer();
  const seriesId = String(formData.get("seriesId") ?? "");
  const seriesEventId = String(formData.get("seriesEventId") ?? "");
  if (!seriesEventId) return;

  await supabase.from("series_events").delete().eq("id", seriesEventId);
  revalidatePath(`/series/${seriesId}`);
}
