import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStandings, type LeaderboardRow, type ScoringConfig, type Standing } from "@/lib/leaderboard";

// A single team's final finish at a single event, after the series-wide
// tier chain has been applied (so a team in Not So RX ranks below the
// worst RX finisher when both share a tier chain). The same shape is
// consumed by two downstream rollups:
//
//   - Season rank (lib/seriesStandings.ts) fans each placement out to
//     every teammate's profile_id and converts position→points via
//     the series' pointsConfig.
//   - Community Cup (lib/communityCup.ts) splits each team's series
//     points across its athletes' gyms in proportion to roster.
//
// Both must see the same ranked position/entrants, which is why the
// tier chain lives here instead of being duplicated.
export type TeamPlacement = {
  registrationId: string;
  displayName: string;
  eventId: string;
  eventName: string;
  divisionId: string;
  gender: string | null;
  position: number; // 1-indexed, after tier chain
  entrants: number; // total entrants across the chain, not just this division
  teamSize: number; // divisions.team_size
};

type DivisionMeta = {
  id: string;
  event_id: string;
  gender: string | null;
  season_tier: number | null;
  team_size: number;
};
type DivisionStanding = { division: DivisionMeta; standings: Standing[] };

export async function fetchSeriesTeamPlacements(
  supabase: SupabaseClient,
  eventIds: string[]
): Promise<TeamPlacement[]> {
  if (eventIds.length === 0) return [];

  const [{ data: divisions }, { data: events }] = await Promise.all([
    supabase
      .from("divisions")
      .select("id, event_id, scoring_config, gender, season_tier, team_size")
      .in("event_id", eventIds),
    supabase.from("events").select("id, name").in("id", eventIds),
  ]);
  const eventNameById = new Map((events ?? []).map((e) => [e.id, e.name]));

  const divisionStandings: DivisionStanding[] = [];
  for (const division of divisions ?? []) {
    const { data: rows } = await supabase
      .from("public_leaderboard")
      .select("heat_assignment_id, workout_id, value_raw, registration_id, display_name, tiebreak_value")
      .eq("division_id", division.id);
    if (!rows || rows.length === 0) continue;

    const divisionScoringConfig = (division.scoring_config ?? { method: "rank_sum" }) as ScoringConfig;
    const { standings } = computeStandings(rows as LeaderboardRow[], divisionScoringConfig);
    if (standings.length === 0) continue;

    divisionStandings.push({ division, standings });
  }

  const placements: TeamPlacement[] = [];

  const tieredGroups = new Map<string, DivisionStanding[]>();
  for (const ds of divisionStandings) {
    const eventName = eventNameById.get(ds.division.event_id) ?? "Event";
    // season_tier alone is enough to chain divisions together — gender
    // only splits the chain into separate male/female tracks when it's
    // actually tracked. Requiring both meant team events (never
    // gender-tagged) silently skipped tiering and every division
    // restarted its own points at the winner value.
    if (ds.division.season_tier) {
      const key = `${ds.division.event_id}::${ds.division.gender}`;
      const group = tieredGroups.get(key) ?? [];
      group.push(ds);
      tieredGroups.set(key, group);
    } else {
      for (const s of ds.standings) {
        placements.push({
          registrationId: s.registrationId,
          displayName: s.displayName,
          eventId: ds.division.event_id,
          eventName,
          divisionId: ds.division.id,
          gender: ds.division.gender,
          position: s.place,
          entrants: ds.standings.length,
          teamSize: ds.division.team_size,
        });
      }
    }
  }

  for (const group of tieredGroups.values()) {
    group.sort((a, b) => (a.division.season_tier ?? 0) - (b.division.season_tier ?? 0));
    const totalEntrants = group.reduce((sum, ds) => sum + ds.standings.length, 0);
    let offset = 0;
    for (const ds of group) {
      const eventName = eventNameById.get(ds.division.event_id) ?? "Event";
      for (const s of ds.standings) {
        placements.push({
          registrationId: s.registrationId,
          displayName: s.displayName,
          eventId: ds.division.event_id,
          eventName,
          divisionId: ds.division.id,
          gender: ds.division.gender,
          position: offset + s.place,
          entrants: totalEntrants,
          teamSize: ds.division.team_size,
        });
      }
      offset += ds.standings.length;
    }
  }

  return placements;
}
