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

      // public_registration_profiles (migration-052), not the raw
      // registrations table — a real athlete's own session can only see
      // THEIR OWN row in `registrations` (RLS), which would otherwise
      // silently drop every other competitor and rank the caller "1 of
      // 1" against themselves. This view exposes just enough (no PII)
      // for any caller to resolve the whole field.
      const { data: registrations } = await supabase
        .from("public_registration_profiles")
        .select("registration_id, captain_profile_id")
        .in(
          "registration_id",
          standings.map((s) => s.registrationId)
        );
      const profileByRegistration = new Map(
        (registrations ?? []).map((r) => [r.registration_id, r.captain_profile_id])
      );

      return standings.flatMap((s): SeriesEventPlacement[] => {
        const profileId = profileByRegistration.get(s.registrationId);
        if (!profileId) return [];
        // s.place (not row index) so a tie for e.g. 11th earns both
        // athletes 11th's season points, matching the event leaderboard.
        return [{ profileId, displayName: s.displayName, position: s.place, entrants: standings.length }];
      });
    })
  );

  // Historical placements (events run outside Wodflow, e.g. Indy/Remix
  // — see migration-051) count toward the same season points, using the
  // exact same position+entrants -> points formula. Matched to a real
  // profile server-side (public_historical_placements), so an athlete
  // who hasn't signed up yet just doesn't appear — nothing to backfill.
  const { data: historical } = await supabase
    .from("public_historical_placements")
    .select("profile_id, display_name, position, entrants");
  const historicalPlacements: SeriesEventPlacement[] = (historical ?? []).map((h) => ({
    profileId: h.profile_id,
    displayName: h.display_name,
    position: h.position,
    entrants: h.entrants,
  }));

  const placements = [...perDivision.flat(), ...historicalPlacements];
  return computeSeriesStandings(placements, pointsConfig);
}
