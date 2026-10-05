import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoringConfig } from "@/lib/leaderboard";
import { computeSeriesStandings, type SeriesEventPlacement, type SeriesStanding } from "@/lib/series";
import { fetchSeriesTeamPlacements } from "@/lib/eventTeamPlacements";

type HistoricalRow = {
  profile_id: string | null;
  identity_hash: string;
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
// signed up). Falls back to a hash of their email as a stable identity;
// once they do sign up with the matching email, public_historical_placements
// (a live view, never a snapshot) resolves their real profile_id
// automatically on the next read — no manual merge step. The hash
// (migration-089) replaces the raw email that used to live on the view,
// so anon-level public pages can read it without leaking addresses.
function identityKey(row: HistoricalRow): string {
  return row.profile_id ?? `identity:${row.identity_hash}`;
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
  seasonYear: number | null
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
  const teamPlacements = await fetchSeriesTeamPlacements(supabase, eventIds);

  if (teamPlacements.length > 0) {
    // public_team_rosters (migration-055 adds profile_id) — every
    // teammate's own profile, not just the captain. Same deliberate-RLS-
    // bypass pattern as public_registration_profiles: a real athlete's
    // own session otherwise can't see other competitors' rosters at all.
    const allRegistrationIds = [...new Set(teamPlacements.map((t) => t.registrationId))];
    const { data: roster } = await supabase
      .from("public_team_rosters")
      .select("registration_id, profile_id")
      .in("registration_id", allRegistrationIds);
    // Dedupe by profile_id per registration — if a roster row ever
    // gets a wrong profile_id stamped on it (e.g. captain's id leaks
    // onto a teammate row during signup, found 2026-10-04 at Big One),
    // we must not credit the same profile twice for the same team
    // placement.
    const profileIdsByRegistration = new Map<string, string[]>();
    const seenPerReg = new Map<string, Set<string>>();
    for (const r of roster ?? []) {
      if (!r.profile_id) continue;
      const seen = seenPerReg.get(r.registration_id) ?? new Set<string>();
      if (seen.has(r.profile_id)) continue;
      seen.add(r.profile_id);
      seenPerReg.set(r.registration_id, seen);
      const arr = profileIdsByRegistration.get(r.registration_id) ?? [];
      arr.push(r.profile_id);
      profileIdsByRegistration.set(r.registration_id, arr);
    }

    for (const t of teamPlacements) {
      for (const profileId of profileIdsByRegistration.get(t.registrationId) ?? []) {
        placements.push({
          profileId,
          displayName: t.displayName,
          position: t.position,
          entrants: t.entrants,
          eventName: t.eventName,
          gender: t.gender,
        });
      }
    }
  }

  // Historical placements (events run outside Wodflow, e.g. Indy/Remix —
  // see migration-051), tiered the same way when tagged. Scoped to this
  // season's year (migration-073) — season rank is a per-year thing, not
  // a lifetime total, so 2025 comps shouldn't bleed into a 2026 rank.
  // seasonYear === null opts out of that scoping entirely (the athlete
  // portal's all-time "Rumble rank" — every season's results counts,
  // not just the current one).
  let historicalQuery = supabase
    .from("public_historical_placements")
    .select("profile_id, identity_hash, display_name, event_name, position, entrants, gender, season_tier");
  if (seasonYear !== null) {
    historicalQuery = historicalQuery.eq("season_year", seasonYear);
  }
  const { data: historical } = await historicalQuery;

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
