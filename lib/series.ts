import { pointsForPosition, type ScoringConfig } from "@/lib/leaderboard";

// One event's overall division result for one athlete — computed
// upstream from that division's own Standing[] (lib/leaderboard.ts),
// re-ranked 1..N within the division, then converted to series points
// via the series' own points_config. Season/BIG leaderboard points are
// attributed to profileId (the athlete's persistent account), not
// registration_id, since a profile is what actually persists across
// events — a hard prerequisite from Milestone 14.
//
// eventName/gender are for display only (admin season leaderboard
// spot-checks, see app/(admin)/series/[seriesId]/leaderboard) — the
// ranking math itself only ever uses position/entrants.
export type SeriesEventPlacement = {
  profileId: string;
  displayName: string;
  position: number;
  entrants: number;
  eventName: string;
  gender: string | null;
};

export type SeriesStanding = {
  profileId: string;
  displayName: string;
  totalPoints: number;
  eventsCounted: number;
  gender: string | null;
  // Points earned per event name, e.g. { "Indy 2026": 40, "Remix 2026": 60 }
  // — lets an organizer spot-check a total against what each individual
  // comp actually contributed, not just trust the sum.
  pointsByEvent: Record<string, number>;
};

export function computeSeriesStandings(
  placements: SeriesEventPlacement[],
  pointsConfig: ScoringConfig = { method: "gap_formula", winner_points: 100 }
): SeriesStanding[] {
  const byProfile = new Map<
    string,
    { displayName: string; totalPoints: number; eventsCounted: number; gender: string | null; pointsByEvent: Record<string, number> }
  >();

  for (const p of placements) {
    const points = pointsForPosition(p.position, p.entrants, pointsConfig);
    const existing = byProfile.get(p.profileId);
    if (existing) {
      existing.totalPoints += points;
      existing.eventsCounted += 1;
      existing.pointsByEvent[p.eventName] = (existing.pointsByEvent[p.eventName] ?? 0) + points;
      // A profile's gender should be consistent across every placement
      // they earn — fill it in if an earlier placement happened not to
      // carry one (untagged standalone division).
      if (!existing.gender && p.gender) existing.gender = p.gender;
    } else {
      byProfile.set(p.profileId, {
        displayName: p.displayName,
        totalPoints: points,
        eventsCounted: 1,
        gender: p.gender,
        pointsByEvent: { [p.eventName]: points },
      });
    }
  }

  return [...byProfile.entries()]
    .map(([profileId, v]) => ({ profileId, ...v }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
