import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeCommunityCupForSeries } from "@/lib/communityCup";
import { updateCommunityCupConfig } from "../../actions";

export default async function AdminCommunityCupPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const supabase = await createClient();

  const { data: series } = await supabase
    .from("series")
    .select("id, name, year, community_cup_enabled, community_cup_min_athletes")
    .eq("id", seriesId)
    .single();
  if (!series) {
    return <p className="text-center py-20 text-red-700">Series not found.</p>;
  }

  const result = await computeCommunityCupForSeries(supabase, seriesId);
  const eligibleCount = result.gyms.filter((g) => g.eligible).length;
  const belowThresholdCount = result.gyms.filter((g) => g.approved && !g.eligible).length;
  const pendingContributions = result.gyms
    .filter((g) => !g.approved)
    .reduce((sum, g) => sum + g.totalPoints, 0);
  const unallocatedTotal = Object.values(result.unallocatedPointsByEvent).reduce((a, b) => a + b, 0);

  const eventColumnOrder = Object.keys(result.unallocatedPointsByEvent).sort();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href={`/series/${seriesId}`} className="text-accent text-sm hover:underline">
          ← {series.name}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">
          {series.name} — Community Cup ({series.year})
        </h1>
      </div>

      <form action={updateCommunityCupConfig} className="bg-white border border-ink/10 rounded-xl p-4 space-y-3">
        <input type="hidden" name="seriesId" value={seriesId} />
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">Public page</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={series.community_cup_enabled}
            className="h-4 w-4"
          />
          <span>
            Publish the Community Cup leaderboard at <code className="text-xs">/rumble-series/{seriesId}/community-cup</code>
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <span>Athletes needed before a gym appears publicly:</span>
          <input
            type="number"
            name="minAthletes"
            defaultValue={series.community_cup_min_athletes}
            min={1}
            className="w-20 border border-ink/15 rounded-md px-2 py-1 text-sm"
          />
        </label>
        <div className="pt-2">
          <button type="submit" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-semibold">
            Save
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <SummaryTile label="Eligible gyms" value={eligibleCount} />
        <SummaryTile label="Below threshold" value={belowThresholdCount} />
        <SummaryTile label="Pending (unapproved)" value={pendingContributions.toFixed(1)} suffix="pts" />
        <SummaryTile label="Unallocated" value={unallocatedTotal.toFixed(1)} suffix="pts" />
      </div>

      {result.gyms.length === 0 ? (
        <div className="bg-white border border-ink/10 rounded-xl p-8 text-center text-ink/60">
          No gym allocations yet — events in this series haven&apos;t produced any scored results.
        </div>
      ) : (
        <div className="bg-white border border-ink/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink/5 text-left text-xs uppercase tracking-wider text-ink/60 align-bottom">
                <th className="px-3 py-3">Gym</th>
                <th className="px-3 py-3 text-right">Athletes</th>
                {eventColumnOrder.map((n) => (
                  <th key={n} className="px-2 py-3 text-right whitespace-normal break-words text-[10px] leading-tight">
                    {n}
                  </th>
                ))}
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.gyms.map((g) => (
                <tr key={g.gymId ?? g.gymName} className="border-t border-ink/10">
                  <td className="px-3 py-2">{g.gymName}</td>
                  <td className="px-3 py-2 text-right font-data">{g.distinctAthleteCount}</td>
                  {eventColumnOrder.map((n) => (
                    <td key={n} className="px-2 py-2 text-right font-data text-ink/70 text-xs">
                      {g.pointsByEvent[n] ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-data font-bold">{g.totalPoints}</td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge gym={g} minAthletes={result.minAthletes} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unallocatedTotal > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <strong>Unallocated points:</strong> {unallocatedTotal.toFixed(1)} total.{" "}
          Teammates with no gym on their roster leave their share of team points unassigned.
          Encourage captains to make sure every teammate has a gym selected at signup.
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="bg-white border border-ink/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink/50">{label}</div>
      <div className="font-data font-bold text-ink mt-1">
        {value}
        {suffix ? <span className="text-ink/50 font-normal text-xs ml-1">{suffix}</span> : null}
      </div>
    </div>
  );
}

function StatusBadge({ gym, minAthletes }: { gym: { approved: boolean; eligible: boolean; distinctAthleteCount: number }; minAthletes: number }) {
  if (!gym.approved) {
    return <span className="text-xs rounded-full bg-ink/10 text-ink/60 px-2 py-0.5">Pending</span>;
  }
  if (!gym.eligible) {
    return (
      <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
        {gym.distinctAthleteCount}/{minAthletes}
      </span>
    );
  }
  return <span className="text-xs rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">Public</span>;
}
