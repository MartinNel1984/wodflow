import { pointsForPosition, type ScoringConfig } from "@/lib/leaderboard";

// One event's overall division result for one athlete — computed
// upstream from that division's own Standing[] (lib/leaderboard.ts),
// re-ranked 1..N within the division, then converted to series points
// via the series' own points_config. Season/BIG leaderboard points are
// attributed to profileId (the athlete's persistent account), not
// registration_id, since a profile is what actually persists across
// events — a hard prerequisite from Milestone 14.
export type SeriesEventPlacement = {
  profileId: string;
  displayName: string;
  position: number;
  entrants: number;
};

export type SeriesStanding = {
  profileId: string;
  displayName: string;
  totalPoints: number;
  eventsCounted: number;
};

export function computeSeriesStandings(
  placements: SeriesEventPlacement[],
  pointsConfig: ScoringConfig = { method: "gap_formula", winner_points: 100 }
): SeriesStanding[] {
  const byProfile = new Map<string, { displayName: string; totalPoints: number; eventsCounted: number }>();

  for (const p of placements) {
    const points = pointsForPosition(p.position, p.entrants, pointsConfig);
    const existing = byProfile.get(p.profileId);
    if (existing) {
      existing.totalPoints += points;
      existing.eventsCounted += 1;
    } else {
      byProfile.set(p.profileId, { displayName: p.displayName, totalPoints: points, eventsCounted: 1 });
    }
  }

  return [...byProfile.entries()]
    .map(([profileId, v]) => ({ profileId, ...v }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
