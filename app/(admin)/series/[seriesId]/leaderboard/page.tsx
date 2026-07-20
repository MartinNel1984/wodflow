import { createClient } from "@/lib/supabase/server";
import { computeStandings, type LeaderboardRow, type ScoringConfig } from "@/lib/leaderboard";
import { computeSeriesStandings, type SeriesEventPlacement } from "@/lib/series";
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

  const placements: SeriesEventPlacement[] = [];

  if (eventIds.length > 0) {
    const { data: divisions } = await supabase
      .from("divisions")
      .select("id, scoring_config")
      .in("event_id", eventIds);

    for (const division of divisions ?? []) {
      const { data: rows } = await supabase
        .from("public_leaderboard")
        .select("heat_assignment_id, workout_id, value_raw, registration_id, display_name, tiebreak_value")
        .eq("division_id", division.id);
      if (!rows || rows.length === 0) continue;

      const divisionScoringConfig = (division.scoring_config ?? { method: "rank_sum" }) as ScoringConfig;
      const { standings } = computeStandings(rows as LeaderboardRow[], divisionScoringConfig);
      if (standings.length === 0) continue;

      // Season points are attributed to the athlete's persistent account
      // (registrations.captain_profile_id), not the per-event
      // registration — a registration made without a signed-in account
      // (still fully supported for one-off events) simply can't be
      // attributed to a season identity and is excluded here.
      const { data: registrations } = await supabase
        .from("registrations")
        .select("id, captain_profile_id")
        .in(
          "id",
          standings.map((s) => s.registrationId)
        );
      const profileByRegistration = new Map((registrations ?? []).map((r) => [r.id, r.captain_profile_id]));

      standings.forEach((s, i) => {
        const profileId = profileByRegistration.get(s.registrationId);
        if (!profileId) return;
        placements.push({
          profileId,
          displayName: s.displayName,
          position: i + 1,
          entrants: standings.length,
        });
      });
    }
  }

  const seriesStandings = computeSeriesStandings(placements, pointsConfig);

  // Prefer the athlete's own profile name over whatever display name a
  // particular event happened to show (e.g. a team name) — a season
  // leaderboard tracks the person, not the team they entered with once.
  const profileIds = seriesStandings.map((s) => s.profileId);
  const { data: profiles } =
    profileIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] };
  const nameByProfile = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <Link href={`/series/${seriesId}`} className="text-accent text-sm hover:underline">
          ← {series.name}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">
          {series.name} — Season Leaderboard ({series.year})
        </h1>
      </div>

      <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink/5 text-left">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Athlete</th>
              <th className="px-4 py-2">Events</th>
              <th className="px-4 py-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {seriesStandings.map((s, i) => (
              <tr key={s.profileId} className="border-t border-ink/10">
                <td className="px-4 py-2 font-data font-bold text-accent">{i + 1}</td>
                <td className="px-4 py-2">{nameByProfile.get(s.profileId) ?? s.displayName}</td>
                <td className="px-4 py-2 text-ink/60">{s.eventsCounted}</td>
                <td className="px-4 py-2 text-right font-data">{s.totalPoints}</td>
              </tr>
            ))}
            {seriesStandings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink/60 text-sm">
                  No scored results yet from any athlete who registered via a signed-in account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
