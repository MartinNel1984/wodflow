import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { isPrivilegedFor } from "@/lib/auth";
import type { BrandKit } from "@/lib/brandKit";
import HeatsView from "./view";

export const revalidate = 8;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ divisionId: string }>;
}): Promise<Metadata> {
  const { divisionId } = await params;
  const supabase = createPublicClient();
  const { data: division } = await supabase
    .from("divisions")
    .select("name, events(name)")
    .eq("id", divisionId)
    .single();
  if (!division) return {};

  const event = Array.isArray(division.events) ? division.events[0] : division.events;
  const title = event?.name ? `${division.name} Heats — ${event.name}` : `${division.name} Heats`;
  return {
    title,
    description: `Heat sheet for ${division.name}${event?.name ? ` at ${event.name}` : ""} on Wodflow.`,
  };
}

export default async function PublicHeatSheetPage({
  params,
}: {
  params: Promise<{ divisionId: string }>;
}) {
  const { divisionId } = await params;
  const supabase = createPublicClient();

  const { data: divisionEvent } = await supabase
    .from("divisions")
    .select("events(organization_id, results_visible)")
    .eq("id", divisionId)
    .single();
  const gateEvent = Array.isArray(divisionEvent?.events) ? divisionEvent.events[0] : divisionEvent?.events;
  const isPreview = gateEvent?.results_visible === false && (await isPrivilegedFor(gateEvent.organization_id));
  const isHidden = gateEvent?.results_visible === false && !isPreview;

  if (isHidden) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-ink/60 text-sm">Heat sheet isn&apos;t available yet — check back on event day.</p>
      </div>
    );
  }

  const [{ data: division }, { data: rows }, { data: allWorkouts }] = await Promise.all([
    supabase
      .from("divisions")
      .select(
        "name, events(brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline))"
      )
      .eq("id", divisionId)
      .single(),
    supabase
      .from("public_heat_sheet")
      .select(
        "heat_id, workout_id, workout_name, workout_sequence, heat_number, start_time, lane_number, display_name"
      )
      .eq("division_id", divisionId)
      .order("workout_sequence", { ascending: true })
      .order("heat_number", { ascending: true })
      .order("lane_number", { ascending: true }),
    // Every workout in the division, not just ones with heats generated
    // already — so the dropdown lists an upcoming WOD with a "heats not
    // generated yet" state instead of silently omitting it (Tjokkie,
    // 2026-09-01: wants to see the workout dropdown "once assigned",
    // implying the workout itself is visible before assignment too).
    supabase.from("workouts").select("id, name, sequence").eq("division_id", divisionId).order("sequence"),
  ]);

  // Grouped by workout first (dropdown), then by heat_id within it —
  // heat numbering resets per workout, so two different heats (from two
  // different WODs) can share the same heat_number within one division.
  // Legacy heats predating the workout builder (migration-022) have a
  // null workout_id/workout_name — grouped under a single "Heats"
  // fallback bucket so they still render instead of vanishing.
  const workoutMap = new Map<
    string,
    {
      workoutId: string | null;
      workoutName: string;
      sequence: number;
      heats: Map<
        string,
        { heatNumber: number; startTime: string; lanes: { laneNumber: number; displayName: string }[] }
      >;
    }
  >();
  for (const w of allWorkouts ?? []) {
    workoutMap.set(w.id, { workoutId: w.id, workoutName: w.name, sequence: w.sequence, heats: new Map() });
  }
  for (const row of rows ?? []) {
    const workoutKey = row.workout_id ?? "__legacy__";
    if (!workoutMap.has(workoutKey)) {
      workoutMap.set(workoutKey, {
        workoutId: row.workout_id,
        workoutName: row.workout_name ?? "Heats",
        sequence: row.workout_sequence ?? Number.MAX_SAFE_INTEGER,
        heats: new Map(),
      });
    }
    const workout = workoutMap.get(workoutKey)!;
    if (!workout.heats.has(row.heat_id)) {
      workout.heats.set(row.heat_id, { heatNumber: row.heat_number, startTime: row.start_time, lanes: [] });
    }
    workout.heats.get(row.heat_id)!.lanes.push({ laneNumber: row.lane_number, displayName: row.display_name });
  }

  const workouts = [...workoutMap.values()]
    .sort((a, b) => a.sequence - b.sequence)
    .map((w) => ({
      id: w.workoutId ?? "__legacy__",
      name: w.workoutName,
      heats: [...w.heats.entries()]
        .sort(([, a], [, b]) => a.heatNumber - b.heatNumber)
        .map(([heatId, h]) => ({
          heatId,
          heatNumber: h.heatNumber,
          startTime: h.startTime,
          lanes: h.lanes.sort((a, b) => a.laneNumber - b.laneNumber),
        })),
    }));

  const event = Array.isArray(division?.events) ? division.events[0] : division?.events;
  const brandKit = (Array.isArray(event?.brand_kits) ? event.brand_kits[0] : event?.brand_kits) as
    | BrandKit
    | null
    | undefined;

  return (
    <HeatsView
      divisionName={division?.name ?? "Heat sheet"}
      workouts={workouts}
      brandKit={brandKit ?? null}
      isPreview={isPreview}
    />
  );
}
