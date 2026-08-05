import { pointsForPosition, type ScoringConfig } from "@/lib/leaderboard";

export type HistoricalEventResultRow = {
  athlete_name: string;
  team_name: string | null;
  division_name: string;
  position: number;
  entrants: number;
  gender: "male" | "female" | null;
  season_tier: number | null;
};

export type HistoricalEventPlacement = HistoricalEventResultRow & { points: number };

// Same tiering rule as the season leaderboard (lib/seriesStandings.ts):
// divisions tagged with both gender + season_tier get combined into one
// ranked field per gender (RX's worst finisher always outscores Not So
// RX's best), so a single past event's results page shows the exact
// points that event actually contributed to the season standings —
// not a re-derived approximation. Untagged divisions are scored
// standalone, same as today.
export function computeHistoricalEventPoints(
  rows: HistoricalEventResultRow[],
  pointsConfig: ScoringConfig
): HistoricalEventPlacement[] {
  const out: HistoricalEventPlacement[] = [];

  const byDivision = new Map<string, HistoricalEventResultRow[]>();
  for (const r of rows) {
    const arr = byDivision.get(r.division_name) ?? [];
    arr.push(r);
    byDivision.set(r.division_name, arr);
  }

  const tieredGroups = new Map<string, { division_name: string; season_tier: number; rows: HistoricalEventResultRow[] }[]>();
  for (const [divisionName, divisionRows] of byDivision) {
    const gender = divisionRows[0].gender;
    const seasonTier = divisionRows[0].season_tier;
    if (gender && seasonTier) {
      const key = gender;
      const group = tieredGroups.get(key) ?? [];
      group.push({ division_name: divisionName, season_tier: seasonTier, rows: divisionRows });
      tieredGroups.set(key, group);
    } else {
      for (const r of divisionRows) {
        out.push({ ...r, points: pointsForPosition(r.position, r.entrants, pointsConfig) });
      }
    }
  }

  for (const group of tieredGroups.values()) {
    group.sort((a, b) => a.season_tier - b.season_tier);
    const totalEntrants = group.reduce((sum, g) => sum + g.rows[0].entrants, 0);
    let offset = 0;
    for (const g of group) {
      for (const r of g.rows) {
        out.push({ ...r, points: pointsForPosition(offset + r.position, totalEntrants, pointsConfig) });
      }
      offset += g.rows[0].entrants;
    }
  }

  return out;
}
