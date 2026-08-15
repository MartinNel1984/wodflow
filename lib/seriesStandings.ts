import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStandings, type LeaderboardRow, type ScoringConfig, type Standing } from "@/lib/leaderboard";
import { computeSeriesStandings, type SeriesEventPlacement, type SeriesStanding } from "@/lib/series";

type DivisionMeta = { id: string; event_id: string; gender: string | null; season_tier: number | null };
type DivisionStanding = { division: DivisionMeta; standings: Standing[] };

type HistoricalRow = {
  profile_id: string | null;
  athlete_email: string;
  display_name: string;
  event_name: string;
  position: number;
  entrants: number;
  gender: string | null;
  season_tier: number | null;
};

// An athlete who placed at Indy/Remix but hasn't signed up on Wodflow
// yet still has no profiles row to key on (Martin: "if a Ruan Potgieter
// is first he is first" — placement counts whether or not they've
// signed up). Falls back to their email as a stable identity; once
// they do sign up with the matching email, public_historical_placements
// (migration-057, a live view, never a snapshot) resolves their real
// profile_id automatically on the next read — no manual merge step.
function identityKey(row: HistoricalRow): string {
  return row.profile_id ?? `email:${row.athlete_email}`;
}

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
  pointsConfig: ScoringConfig,
  seasonYear: number
): Promise<SeriesStanding[]> {
  const placements: SeriesEventPlacement[] = [];

  // Historical placements (events run outside Wodflow, e.g. Indy/Remix)
  // don't depend on eventIds at all — they're pulled unconditionally
  // below — so they must never be skipped just because the series'
  // live event(s) haven't published results yet. Found 2026-08-15:
  // season rank on the athlete portal was showing "—" for everyone
  // because the only live event linked to the 2026 series was still
  // hidden, which (via the old early-return) also silently excluded
  // Indy 2026 and Remix 2026's already-final historical results.
  if (eventIds.length > 0) {
    const [{ data: divisions }, { data: events }] = await Promise.all([
      supabase.from("divisions").select("id, event_id, scoring_config, gender, season_tier").in("event_id", eventIds),
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

    function pushTeamPlacement(
      registrationId: string,
      displayName: string,
      position: number,
      entrants: number,
      eventName: string,
      gender: string | null
    ) {
      for (const profileId of profileIdsByRegistration.get(registrationId) ?? []) {
        placements.push({ profileId, displayName, position, entrants, eventName, gender });
      }
    }

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
        // Standalone — unchanged behavior, normalized entirely on its own.
        for (const s of ds.standings) {
          pushTeamPlacement(s.registrationId, s.displayName, s.place, ds.standings.length, eventName, ds.division.gender);
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
          pushTeamPlacement(s.registrationId, s.displayName, offset + s.place, totalEntrants, eventName, ds.division.gender);
        }
        offset += ds.standings.length;
      }
    }
  }

  // Historical placements (events run outside Wodflow, e.g. Indy/Remix —
  // see migration-051), tiered the same way when tagged. Scoped to this
  // season's year (migration-073) — season rank is a per-year thing, not
  // a lifetime total, so 2025 comps shouldn't bleed into a 2026 rank.
  const { data: historical } = await supabase
    .from("public_historical_placements")
    .select("profile_id, athlete_email, display_name, event_name, position, entrants, gender, season_tier")
    .eq("season_year", seasonYear);

  const historicalTieredGroups = new Map<string, HistoricalRow[]>();
  for (const h of (historical ?? []) as HistoricalRow[]) {
    // Same season_tier-alone rule as the live-division loop above —
    // Rumble Teams' historical rows have season_tier but no gender tag.
    if (h.season_tier) {
      const key = `${h.event_name}::${h.gender}`;
      const group = historicalTieredGroups.get(key) ?? [];
      group.push(h);
      historicalTieredGroups.set(key, group);
    } else {
      placements.push({
        profileId: identityKey(h),
        displayName: h.display_name,
        position: h.position,
        entrants: h.entrants,
        eventName: h.event_name,
        gender: h.gender,
      });
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
        placements.push({
          profileId: identityKey(h),
          displayName: h.display_name,
          position: offset + h.position,
          entrants: totalEntrants,
          eventName: h.event_name,
          gender: h.gender,
        });
      }
      offset += rowsForTier[0].entrants;
    }
  }

  return computeSeriesStandings(placements, pointsConfig);
}
