import { createClient } from "@/lib/supabase/server";
import type { ScoringConfig } from "@/lib/leaderboard";
import { computeSeriesStandingsForEvents } from "@/lib/seriesStandings";
import type { SeriesStanding } from "@/lib/series";
import Link from "next/link";

export default async function SeriesLeaderboardPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const supabase = await createClient();

  const { data: series } = await supabase
    .from("series")
    .select("id, name, year, points_config, series_events(event_id)")
    .eq("id", seriesId)
    .single();

  if (!series) {
    return <p className="text-center py-20 text-red-700">Series not found.</p>;
  }

  const eventIds = (series.series_events ?? []).map((se) => se.event_id);
  const pointsConfig = (series.points_config ?? { method: "gap_formula", winner_points: 100 }) as ScoringConfig;

  // Season points are attributed to the athlete's persistent account
  // (registrations.captain_profile_id), not the per-event registration —
  // a registration made without a signed-in account (still fully
  // supported for one-off events) can't be attributed to a season
  // identity and is excluded here. See lib/seriesStandings.ts.
  const seriesStandings = await computeSeriesStandingsForEvents(supabase, eventIds, pointsConfig);

  // Prefer the athlete's own profile name over whatever display name a
  // particular event happened to show (e.g. a team name) — a season
  // leaderboard tracks the person, not the team they entered with once.
  //
  // Not every standing has a real profile UUID — an athlete who placed
  // at a historical event but hasn't signed up on Wodflow yet gets a
  // synthetic "email:..." identity instead (see lib/seriesStandings.ts),
  // which would make .in("id", ...) error against the uuid column.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const profileIds = seriesStandings.map((s) => s.profileId).filter((id) => uuidPattern.test(id));
  const { data: profiles } =
    profileIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] };
  const nameByProfile = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // Split by gender so Martin/Tjokkie can spot-check the combined
  // ranking the way it's actually meant to be read — Male and Female
  // are separate competitions, never ranked against each other.
  const male = seriesStandings.filter((s) => s.gender === "male");
  const female = seriesStandings.filter((s) => s.gender === "female");
  const ungrouped = seriesStandings.filter((s) => s.gender !== "male" && s.gender !== "female");

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link href={`/series/${seriesId}`} className="text-accent text-sm hover:underline">
          ← {series.name}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">
          {series.name} — Season Leaderboard ({series.year})
        </h1>
      </div>

      <StandingsTable title="Male" standings={male} nameByProfile={nameByProfile} />
      <StandingsTable title="Female" standings={female} nameByProfile={nameByProfile} />
      {ungrouped.length > 0 && (
        <StandingsTable
          title="Ungrouped (no gender tagged on the division/result)"
          standings={ungrouped}
          nameByProfile={nameByProfile}
        />
      )}
    </div>
  );
}

// Left-to-right reading order Martin wants on the season leaderboard,
// oldest/most-recently-run first through to the newest — event names
// not in this list (a future comp not yet named here) fall in
// alphabetically at the end rather than disappearing.
const EVENT_COLUMN_ORDER = ["Indy 2026", "Remix 2026", "Big Rumble 2025", "Rumble Indy 2025", "Rumble Teams 2025"];

function orderEventNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const ai = EVENT_COLUMN_ORDER.indexOf(a);
    const bi = EVENT_COLUMN_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

function StandingsTable({
  title,
  standings,
  nameByProfile,
}: {
  title: string;
  standings: SeriesStanding[];
  nameByProfile: Map<string, string | null>;
}) {
  // Dynamic columns — whichever comps actually contributed points for
  // this group (e.g. "Rumble Indy 2025", "Indy 2026", "Remix 2026").
  const eventNames = orderEventNames([...new Set(standings.flatMap((s) => Object.keys(s.pointsByEvent)))]);

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">{title}</h2>
      <div className="bg-white border border-ink/10 rounded-xl overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-ink/5 text-left align-bottom">
              <th className="px-2 py-2 w-10">#</th>
              <th className="px-3 py-2 w-40">Athlete</th>
              {eventNames.map((name) => (
                <th key={name} className="px-1.5 py-2 text-right w-16 whitespace-normal break-words text-xs leading-tight font-semibold">
                  {name}
                </th>
              ))}
              <th className="px-3 py-2 text-right w-16">Total</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.profileId} className="border-t border-ink/10">
                <td className="px-2 py-2 font-data font-bold text-accent">{i + 1}</td>
                <td className="px-3 py-2 truncate">{nameByProfile.get(s.profileId) ?? s.displayName}</td>
                {eventNames.map((name) => (
                  <td key={name} className="px-1.5 py-2 text-right font-data text-ink/70 text-xs">
                    {s.pointsByEvent[name] ?? "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-data font-bold">{s.totalPoints}</td>
              </tr>
            ))}
            {standings.length === 0 && (
              <tr>
                <td colSpan={eventNames.length + 3} className="px-4 py-6 text-center text-ink/60 text-sm">
                  No scored results yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
