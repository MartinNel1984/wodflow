import { createClient } from "@/lib/supabase/server";

export default async function PublicHeatSheetPage({
  params,
}: {
  params: Promise<{ divisionId: string }>;
}) {
  const { divisionId } = await params;
  const supabase = await createClient();

  const [{ data: division }, { data: rows }] = await Promise.all([
    supabase.from("divisions").select("name").eq("id", divisionId).single(),
    supabase
      .from("public_heat_sheet")
      .select("heat_id, heat_number, start_time, lane_number, display_name")
      .eq("division_id", divisionId)
      .order("heat_number", { ascending: true })
      .order("lane_number", { ascending: true }),
  ]);

  const heatMap = new Map<
    number,
    { startTime: string; lanes: { laneNumber: number; displayName: string }[] }
  >();
  for (const row of rows ?? []) {
    if (!heatMap.has(row.heat_number)) {
      heatMap.set(row.heat_number, { startTime: row.start_time, lanes: [] });
    }
    heatMap.get(row.heat_number)!.lanes.push({
      laneNumber: row.lane_number,
      displayName: row.display_name,
    });
  }
  const heatNumbers = [...heatMap.keys()].sort((a, b) => a - b);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-center">{division?.name ?? "Heat sheet"}</h1>

      {heatNumbers.map((heatNumber, i) => {
        const heat = heatMap.get(heatNumber)!;
        return (
          <div
            key={heatNumber}
            className="bg-white border border-ink/10 rounded-xl p-4 animate-settle-in"
            style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
          >
            <p className="font-data font-bold text-accent mb-2">
              Heat {heatNumber} · {new Date(heat.startTime).toLocaleTimeString()}
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
      {heatNumbers.length === 0 && (
        <p className="text-center text-ink/60 text-sm">Heats haven&apos;t been published yet.</p>
      )}
    </div>
  );
}
