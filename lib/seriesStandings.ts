import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStandings, type LeaderboardRow, type ScoringConfig, type Standing } from "@/lib/leaderboard";
import { computeSeriesStandings, type SeriesEventPlacement, type SeriesStanding } from "@/lib/series";

type DivisionMeta = { id: string; event_id: string; gender: string | null; season_tier: number | null };
type DivisionStanding = { division: DivisionMeta; standings: Standing[] };

type HistoricalRow = {
  profile_id: string;
  display_name: string;
  event_name: string;
  position: number;
  entrants: number;
  gender: string | null;
  season_tier: number | null;
};

// Shared by the admin season leaderboard and the athlete portal's own
// "season rank" stat — both need the same thing: every division across
// a set of events, re-ranked and converted to season points. Kept as
// one function so the two call sites can't drift out of sync on how
// points get attributed.
//
// Divisions (and historical results) tagged with BOTH gender and
// season_tier get combined into ONE ranked field per event+gender,
// ordered by tier — e.g. every RX (tier 1) team's placement, then Not
// So RX (tier 2) placements continue right where RX left off, so RX's
// worst finisher always outscores Not So RX's best (Martin: incentivize
// moving up, don't let a division choice be a way to farm points).
// Anything missing either tag keeps the old behavior: scored entirely
// on its own. Team placements now credit EVERY teammate individually
// (Martin: "100 points per person"), not just the captain.
export async function computeSeriesStandingsForEvents(
  supabase: SupabaseClient,
  eventIds: string[],
  pointsConfig: ScoringConfig
): Promise<SeriesStanding[]> {
  if (eventIds.length === 0) return [];

  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, event_id, scoring_config, gender, season_tier")
    .in("event_id", eventIds);

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

  // public_team_rosters (migration-055 adds profile_id) — every
  // teammate's own profile, not just the captain. Same deliberate-RLS-
  // bypass pattern as public_registration_profiles: a real athlete's
  // own session otherwise can't see other competitors' rosters at all.
  const allRegistrationIds = divisionStandings.flatMap((d) => d.standings.map((s) => s.registrationId));
  const { data: roster } =
    allRegistrationIds.length > 0
      ? await supabase
          .from("public_team_rosters")
          .select("registration_id, profile_id")
          .in("registration_id", allRegistrationIds)
      : { data: [] as { registration_id: string; profile_id: string | null }[] };
  const profileIdsByRegistration = new Map<string, string[]>();
  for (const r of roster ?? []) {
    if (!r.profile_id) continue;
    const arr = profileIdsByRegistration.get(r.registration_id) ?? [];
    arr.push(r.profile_id);
    profileIdsByRegistration.set(r.registration_id, arr);
  }

  const placements: SeriesEventPlacement[] = [];
  function pushTeamPlacement(registrationId: string, displayName: string, position: number, entrants: number) {
    for (const profileId of profileIdsByRegistration.get(registrationId) ?? []) {
      placements.push({ profileId, displayName, position, entrants });
    }
  }

  const tieredGroups = new Map<string, DivisionStanding[]>();
  for (const ds of divisionStandings) {
    if (ds.division.gender && ds.division.season_tier) {
      const key = `${ds.division.event_id}::${ds.division.gender}`;
      const group = tieredGroups.get(key) ?? [];
      group.push(ds);
      tieredGroups.set(key, group);
    } else {
      // Standalone — unchanged behavior, normalized entirely on its own.
      for (const s of ds.standings) {
        pushTeamPlacement(s.registrationId, s.displayName, s.place, ds.standings.length);
      }
    }
  }

  for (const group of tieredGroups.values()) {
    group.sort((a, b) => (a.division.season_tier ?? 0) - (b.division.season_tier ?? 0));
    const totalEntrants = group.reduce((sum, ds) => sum + ds.standings.length, 0);
    let offset = 0;
    for (const ds of group) {
      for (const s of ds.standings) {
        pushTeamPlacement(s.registrationId, s.displayName, offset + s.place, totalEntrants);
      }
      offset += ds.standings.length;
    }
  }

  // Historical placements (events run outside Wodflow, e.g. Indy/Remix —
  // see migration-051), tiered the same way when tagged.
  const { data: historical } = await supabase
    .from("public_historical_placements")
    .select("profile_id, display_name, event_name, position, entrants, gender, season_tier");

  const historicalTieredGroups = new Map<string, HistoricalRow[]>();
  for (const h of (historical ?? []) as HistoricalRow[]) {
    if (h.gender && h.season_tier) {
      const key = `${h.event_name}::${h.gender}`;
      const group = historicalTieredGroups.get(key) ?? [];
      group.push(h);
      historicalTieredGroups.set(key, group);
    } else {
      placements.push({ profileId: h.profile_id, displayName: h.display_name, position: h.position, entrants: h.entrants });
    }
  }

  for (const group of historicalTieredGroups.values()) {
    const byTier = new Map<number, HistoricalRow[]>();
    for (const h of group) {
      const arr = byTier.get(h.season_tier!) ?? [];
      arr.push(h);
      byTier.set(h.season_tier!, arr);
    }
    const tiers = [...byTier.keys()].sort((a, b) => a - b);
    // Each row within a tier already carries that division's own
    // entrant count (constant per division) — sum one representative
    // row per tier for the combined total.
    const totalEntrants = tiers.reduce((sum, t) => sum + byTier.get(t)![0].entrants, 0);
    let offset = 0;
    for (const t of tiers) {
      const rowsForTier = byTier.get(t)!;
      for (const h of rowsForTier) {
        placements.push({ profileId: h.profile_id, displayName: h.display_name, position: offset + h.position, entrants: totalEntrants });
      }
      offset += rowsForTier[0].entrants;
    }
  }

  return computeSeriesStandings(placements, pointsConfig);
}
