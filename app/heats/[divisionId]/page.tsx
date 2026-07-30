import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { RumbleBackdrop } from "@/components/RumbleBackdrop";
import type { BrandKit } from "@/lib/brandKit";

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

  const [{ data: division }, { data: rows }] = await Promise.all([
    supabase
      .from("divisions")
      .select(
        "name, events(brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline))"
      )
      .eq("id", divisionId)
      .single(),
    supabase
      .from("public_heat_sheet")
      .select("heat_id, workout_name, workout_sequence, heat_number, start_time, lane_number, display_name")
      .eq("division_id", divisionId)
      .order("workout_sequence", { ascending: true })
      .order("heat_number", { ascending: true })
      .order("lane_number", { ascending: true }),
  ]);

  // Keyed by heat_id, not heat_number — heat numbering resets per
  // workout, so two different heats (from two different WODs) can
  // share the same heat_number within one division.
  const heatMap = new Map<
    string,
    {
      heatNumber: number;
      workoutName: string | null;
      startTime: string;
      lanes: { laneNumber: number; displayName: string }[];
    }
  >();
  for (const row of rows ?? []) {
    if (!heatMap.has(row.heat_id)) {
      heatMap.set(row.heat_id, {
        heatNumber: row.heat_number,
        workoutName: row.workout_name,
        startTime: row.start_time,
        lanes: [],
      });
    }
    heatMap.get(row.heat_id)!.lanes.push({
      laneNumber: row.lane_number,
      displayName: row.display_name,
    });
  }
  const heatIds = [...heatMap.keys()];

  const event = Array.isArray(division?.events) ? division.events[0] : division?.events;
  const brandKit = (Array.isArray(event?.brand_kits) ? event.brand_kits[0] : event?.brand_kits) as
    | BrandKit
    | null
    | undefined;
  const isBigOne = brandKit?.name === "Rumble Big One";

  const content = (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-center">{division?.name ?? "Heat sheet"}</h1>

      {heatIds.map((heatId, i) => {
        const heat = heatMap.get(heatId)!;
        return (
          <div
            key={heatId}
            className="bg-white border border-ink/10 rounded-xl p-4 animate-settle-in"
            style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
          >
            <p className="font-data font-bold text-accent mb-2">
              {heat.workoutName ? `${heat.workoutName} · ` : ""}Heat {heat.heatNumber} ·{" "}
              {new Date(heat.startTime).toLocaleTimeString()}
            </p>
            <div className="space-y-1 text-sm">
              {heat.lanes
                .sort((a, b) => a.laneNumber - b.laneNumber)
                .map((lane) => (
                  <p key={lane.laneNumber}>
                    <span className="font-data text-ink/50">Lane {lane.laneNumber}</span> —{" "}
                    {lane.displayName ?? "Unnamed"}
                  </p>
                ))}
            </div>
          </div>
        );
      })}
      {heatIds.length === 0 && (
        <p className="text-center text-ink/60 text-sm">Heats haven&apos;t been published yet.</p>
      )}
    </div>
  );

  if (isBigOne) {
    return (
      <RumbleBackdrop
        logoSrc={brandKit?.logo_url || "/rumble/series-logo-v2.png"}
        logoAlt={brandKit?.name || "Rumble Big One"}
      >
        <div className="w-full bg-white text-ink rounded-2xl shadow-xl">{content}</div>
      </RumbleBackdrop>
    );
  }

  return content;
}
