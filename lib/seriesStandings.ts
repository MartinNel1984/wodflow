import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStandings, type LeaderboardRow, type ScoringConfig } from "@/lib/leaderboard";
import { computeSeriesStandings, type SeriesEventPlacement, type SeriesStanding } from "@/lib/series";

// Shared by the admin season leaderboard and the athlete portal's own
// "season rank" stat — both need the same thing: every division across
// a set of events, re-ranked and converted to season points. Kept as
// one function so the two call sites can't drift out of sync on how
// points get attributed.
export async function computeSeriesStandingsForEvents(
  supabase: SupabaseClient,
  eventIds: string[],
  pointsConfig: ScoringConfig
): Promise<SeriesStanding[]> {
  if (eventIds.length === 0) return [];

  const { data: divisions } = await supabase.from("divisions").select("id, scoring_config").in("event_id", eventIds);

  const perDivision = await Promise.all(
    (divisions ?? []).map(async (division) => {
      const { data: rows } = await supabase
        .from("public_leaderboard")
        .select("heat_assignment_id, workout_id, value_raw, registration_id, display_name, tiebreak_value")
        .eq("division_id", division.id);
      if (!rows || rows.length === 0) return [];

      const divisionScoringConfig = (division.scoring_config ?? { method: "rank_sum" }) as ScoringConfig;
      const { standings } = computeStandings(rows as LeaderboardRow[], divisionScoringConfig);
      if (standings.length === 0) return [];

      const { data: registrations } = await supabase
        .from("registrations")
        .select("id, captain_profile_id")
        .in(
          "id",
          standings.map((s) => s.registrationId)
        );
      const profileByRegistration = new Map((registrations ?? []).map((r) => [r.id, r.captain_profile_id]));

      return standings.flatMap((s, i): SeriesEventPlacement[] => {
        const profileId = profileByRegistration.get(s.registrationId);
        if (!profileId) return [];
        return [{ profileId, displayName: s.displayName, position: i + 1, entrants: standings.length }];
      });
    })
  );

  const placements = perDivision.flat();
  return computeSeriesStandings(placements, pointsConfig);
}
