import type { SupabaseClient } from "@supabase/supabase-js";
import { pointsForPosition, type ScoringConfig } from "@/lib/leaderboard";
import { fetchSeriesTeamPlacements, type TeamPlacement } from "@/lib/eventTeamPlacements";
import { computeSeriesStandingsForEvents } from "@/lib/seriesStandings";
import { createServiceClient } from "@/lib/supabase/service";

// A single gym's rank across the full series. The admin page needs
// to see below-threshold gyms too (hence the eligible flag), the
// public page only renders eligible=true rows.
export type GymStanding = {
  gymId: string | null; // null for pending-but-not-approved writes
  gymName: string;
  approved: boolean;
  totalPoints: number;
  pointsByEvent: Record<string, number>;
  distinctAthleteCount: number;
  eligible: boolean;
};

export type CommunityCupResult = {
  gyms: GymStanding[];
  // Points that landed on no gym (blank teammate rows per strict-
  // proportion rule). Shown on the admin page as a sanity check — if
  // this is a large fraction of total points, gym owners aren't
  // completing rosters.
  unallocatedPointsByEvent: Record<string, number>;
};

// Normalise a free-text gym name to the join key against gyms.name.
// Mirrors the case-insensitive unique index on lower(btrim(name)) from
// migration-088.
function gymKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export async function computeCommunityCup(
  supabase: SupabaseClient,
  args: {
    eventIds: string[];
    pointsConfig: ScoringConfig;
    minAthletes: number;
  }
): Promise<CommunityCupResult> {
  const { eventIds, pointsConfig, minAthletes } = args;

  // --- 1. Finish positions per team per event (reuses shared helper
  //        so this always agrees with the individual season leaderboard
  //        on who placed where).
  const teamPlacements = await fetchSeriesTeamPlacements(supabase, eventIds);
  if (teamPlacements.length === 0) {
    return { gyms: [], unallocatedPointsByEvent: {} };
  }

  // --- 2. Rosters (teammate → gym_name) for every placed team, from
  //        the anon-safe view added in migration-091. Also carries
  //        profile_id (nullable) for the distinct-athlete eligibility
  //        count.
  const allRegistrationIds = [...new Set(teamPlacements.map((t) => t.registrationId))];
  const { data: rosterRows } = await supabase
    .from("public_registration_gyms")
    .select("registration_id, profile_id, gym_name")
    .in("registration_id", allRegistrationIds);

  // Group roster rows by registration — each entry is one teammate slot.
  const rosterByRegistration = new Map<string, { profile_id: string | null; gym_name: string }[]>();
  for (const r of rosterRows ?? []) {
    const arr = rosterByRegistration.get(r.registration_id) ?? [];
    arr.push({ profile_id: r.profile_id, gym_name: r.gym_name });
    rosterByRegistration.set(r.registration_id, arr);
  }

  // --- 3. Gyms master list — canonical names + approval status.
  //        Pending gyms get their contributions held (admin page shows
  //        the aggregate but public page excludes them).
  const { data: gymRows } = await supabase.from("gyms").select("id, name, approved");
  const gymById = new Map<string, { id: string; name: string; approved: boolean }>();
  const canonicalByKey = new Map<string, { id: string; name: string; approved: boolean }>();
  for (const g of gymRows ?? []) {
    gymById.set(g.id, g);
    const key = gymKey(g.name);
    if (key) canonicalByKey.set(key, g);
  }

  // --- 4. Allocate: for each team placement, split that team's series
  //        points across its athletes' gyms in proportion to team_size.
  //        Blank/unknown-gym slots leave their share unallocated.
  type Bucket = {
    gymId: string | null;
    gymName: string; // canonical if matched, raw-but-trimmed otherwise
    approved: boolean;
    totalPoints: number;
    pointsByEvent: Record<string, number>;
    profileIds: Set<string>;
  };
  // Keyed by canonical gym key (lowercased trimmed name). Unknown-key
  // (pending or free-text no-match) writes still get a bucket so admin
  // can see where the points are going.
  const buckets = new Map<string, Bucket>();
  const unallocated: Record<string, number> = {};

  function bucketFor(canonicalKey: string, displayName: string): Bucket {
    let b = buckets.get(canonicalKey);
    if (!b) {
      const match = canonicalByKey.get(canonicalKey);
      b = {
        gymId: match?.id ?? null,
        gymName: match?.name ?? displayName,
        approved: match?.approved ?? false,
        totalPoints: 0,
        pointsByEvent: {},
        profileIds: new Set<string>(),
      };
      buckets.set(canonicalKey, b);
    }
    return b;
  }

  for (const t of teamPlacements) {
    const seriesPoints = pointsForPosition(t.position, t.entrants, pointsConfig);
    if (seriesPoints === 0) continue;

    const perSlotShare = seriesPoints / Math.max(1, t.teamSize);
    const roster = rosterByRegistration.get(t.registrationId) ?? [];

    // Count filled slots in roster (<=teamSize in healthy data). Any
    // "missing" slots (teamSize - roster.length, when positive) are
    // treated as blanks → unallocated.
    let allocatedSlots = 0;
    for (const slot of roster) {
      const key = gymKey(slot.gym_name);
      if (!key) continue; // blank gym on a filled slot → unallocated
      const bucket = bucketFor(key, slot.gym_name.trim());
      bucket.totalPoints += perSlotShare;
      bucket.pointsByEvent[t.eventName] = (bucket.pointsByEvent[t.eventName] ?? 0) + perSlotShare;
      if (slot.profile_id) bucket.profileIds.add(slot.profile_id);
      allocatedSlots += 1;
    }
    const totalSlots = Math.max(roster.length, t.teamSize);
    const unallocatedSlots = totalSlots - allocatedSlots;
    if (unallocatedSlots > 0) {
      unallocated[t.eventName] = (unallocated[t.eventName] ?? 0) + unallocatedSlots * perSlotShare;
    }
  }

  // --- 5. Shape the result. Round to 2 dp for display stability so a
  //        49.9999999 doesn't appear next to a 50 for display reasons.
  function round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  const gyms: GymStanding[] = [...buckets.values()]
    .map((b) => {
      const roundedByEvent: Record<string, number> = {};
      for (const [k, v] of Object.entries(b.pointsByEvent)) roundedByEvent[k] = round2(v);
      const distinct = b.profileIds.size;
      return {
        gymId: b.gymId,
        gymName: b.gymName,
        approved: b.approved,
        totalPoints: round2(b.totalPoints),
        pointsByEvent: roundedByEvent,
        distinctAthleteCount: distinct,
        eligible: b.approved && distinct >= minAthletes,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.gymName.localeCompare(b.gymName));

  const unallocatedPointsByEvent: Record<string, number> = {};
  for (const [k, v] of Object.entries(unallocated)) unallocatedPointsByEvent[k] = round2(v);

  return { gyms, unallocatedPointsByEvent };
}

// Convenience fetcher — admin + public pages both start from a seriesId.
export async function computeCommunityCupForSeries(
  supabase: SupabaseClient,
  seriesId: string
): Promise<CommunityCupResult & { minAthletes: number; enabled: boolean; eventIds: string[] }> {
  const { data: series } = await supabase
    .from("series")
    .select("year, points_config, community_cup_enabled, community_cup_min_athletes, series_events(event_id)")
    .eq("id", seriesId)
    .single();
  if (!series) {
    return {
      gyms: [],
      unallocatedPointsByEvent: {},
      minAthletes: 5,
      enabled: false,
      eventIds: [],
    };
  }
  const eventIds = (series.series_events ?? []).map((se: { event_id: string }) => se.event_id);
  const pointsConfig = (series.points_config ?? { method: "gap_formula", winner_points: 100 }) as ScoringConfig;
  const minAthletes = series.community_cup_min_athletes ?? 5;
  const result = await computeCommunityCup(supabase, {
    eventIds,
    pointsConfig,
    minAthletes,
  });

  // --- Historical contribution. Live wodflow events have team rosters
  //     so Community Cup splits points by gym per teammate (above). But
  //     a Rumble season may also include historical events run before
  //     Wodflow — e.g. Indy 2026 and Remix 2026, stored in
  //     historical_results. Those don't carry team-or-gym info, so we
  //     attribute them to each athlete's *current* gym on their
  //     Wodflow profile. Athletes who haven't claimed a profile yet
  //     stay in "unallocated" so Tjokkie can see how much weight that
  //     bucket carries.
  const seasonYear = series.year ?? null;
  const seriesStandings = await computeSeriesStandingsForEvents(
    supabase,
    eventIds,
    pointsConfig,
    seasonYear
  );

  // Which event names came from live wodflow events? Those are already
  // allocated above — only the OTHER names in pointsByEvent (historical)
  // are new contribution.
  const liveEventNames = new Set<string>();
  if (eventIds.length > 0) {
    const { data: liveEvents } = await supabase
      .from("events")
      .select("name")
      .in("id", eventIds);
    for (const e of liveEvents ?? []) liveEventNames.add(e.name);
  }

  // Collect every historical (profileId, eventName, points) tuple that
  // needs attributing. profileId === null for identity-hash-keyed rows
  // (athlete hasn't signed up on Wodflow yet) → unallocated.
  type HistoricalContribution = { profileId: string | null; eventName: string; points: number };
  const historicalContribs: HistoricalContribution[] = [];
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const s of seriesStandings) {
    const claimedProfileId = uuidPattern.test(s.profileId) ? s.profileId : null;
    for (const [eventName, points] of Object.entries(s.pointsByEvent)) {
      if (liveEventNames.has(eventName)) continue;
      if (!points) continue;
      historicalContribs.push({ profileId: claimedProfileId, eventName, points });
    }
  }

  if (historicalContribs.length === 0) {
    return {
      ...result,
      minAthletes,
      enabled: series.community_cup_enabled ?? false,
      eventIds,
    };
  }

  // Resolve each claimed profile → current gym_name. Service client
  // (profiles is auth-RLS and only owners can read their own row;
  // Community Cup needs cross-athlete visibility). Server-side only —
  // this helper is only ever invoked from the admin + public page
  // server components.
  const claimedProfileIds = [...new Set(
    historicalContribs
      .map((c) => c.profileId)
      .filter((id): id is string => !!id)
  )];
  const gymByProfile = new Map<string, string | null>();
  if (claimedProfileIds.length > 0) {
    const svc = createServiceClient();
    const { data: profiles } = await svc
      .from("profiles")
      .select("id, gym_name")
      .in("id", claimedProfileIds);
    for (const p of profiles ?? []) {
      gymByProfile.set(p.id, p.gym_name);
    }
  }

  // Rebuild the gyms map so we can merge in historical contribution
  // without losing live-event allocations.
  const canonicalByKey = new Map<string, { id: string; name: string; approved: boolean }>();
  const { data: gymRows } = await supabase.from("gyms").select("id, name, approved");
  for (const g of gymRows ?? []) {
    const key = g.name.trim().toLowerCase();
    if (key) canonicalByKey.set(key, g);
  }

  type MutableStanding = {
    gymId: string | null;
    gymName: string;
    approved: boolean;
    totalPoints: number;
    pointsByEvent: Record<string, number>;
    profileIds: Set<string>;
  };
  const standingByKey = new Map<string, MutableStanding>();
  for (const g of result.gyms) {
    const key = g.gymName.trim().toLowerCase();
    standingByKey.set(key, {
      gymId: g.gymId,
      gymName: g.gymName,
      approved: g.approved,
      totalPoints: g.totalPoints,
      pointsByEvent: { ...g.pointsByEvent },
      // profileIds set is lossy on round-trip but historical contrib adds
      // fresh ids we track separately below; eligible-flag recomputes.
      profileIds: new Set<string>(),
    });
  }
  // Seed historical-only gyms (never saw a wodflow team roster entry)
  // from the canonical list on first touch below.

  const unallocatedByEvent: Record<string, number> = { ...result.unallocatedPointsByEvent };

  // Also carry the live-event distinct athlete count forward so a gym
  // that qualifies on wodflow alone stays eligible.
  const liveDistinctByKey = new Map<string, number>();
  for (const g of result.gyms) {
    liveDistinctByKey.set(g.gymName.trim().toLowerCase(), g.distinctAthleteCount);
  }

  // Historical distinct-athlete tracking per gym (profile_ids seen for
  // the historical half; merged with live counts below).
  const historicalProfileIdsByKey = new Map<string, Set<string>>();

  for (const c of historicalContribs) {
    const gymName = c.profileId ? gymByProfile.get(c.profileId) ?? null : null;
    if (!gymName) {
      unallocatedByEvent[c.eventName] = (unallocatedByEvent[c.eventName] ?? 0) + c.points;
      continue;
    }
    const key = gymName.trim().toLowerCase();
    let standing = standingByKey.get(key);
    if (!standing) {
      const canonical = canonicalByKey.get(key);
      standing = {
        gymId: canonical?.id ?? null,
        gymName: canonical?.name ?? gymName.trim(),
        approved: canonical?.approved ?? false,
        totalPoints: 0,
        pointsByEvent: {},
        profileIds: new Set<string>(),
      };
      standingByKey.set(key, standing);
    }
    standing.totalPoints += c.points;
    standing.pointsByEvent[c.eventName] = (standing.pointsByEvent[c.eventName] ?? 0) + c.points;
    if (c.profileId) {
      const seen = historicalProfileIdsByKey.get(key) ?? new Set<string>();
      seen.add(c.profileId);
      historicalProfileIdsByKey.set(key, seen);
    }
  }

  function round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  const mergedGyms: GymStanding[] = [...standingByKey.entries()]
    .map(([key, s]) => {
      const roundedByEvent: Record<string, number> = {};
      for (const [k, v] of Object.entries(s.pointsByEvent)) roundedByEvent[k] = round2(v);
      // distinctAthleteCount: live-event roster count + historical
      // profiles that appeared only in historical. Simple sum is fine
      // because historical half is only ever claimed profile ids and
      // the live half counts registration-time profile_ids; an athlete
      // appearing in both is a strict upgrade (not a duplicate) for
      // eligibility purposes.
      const historicalCount = historicalProfileIdsByKey.get(key)?.size ?? 0;
      const liveCount = liveDistinctByKey.get(key) ?? 0;
      const distinct = liveCount + historicalCount;
      return {
        gymId: s.gymId,
        gymName: s.gymName,
        approved: s.approved,
        totalPoints: round2(s.totalPoints),
        pointsByEvent: roundedByEvent,
        distinctAthleteCount: distinct,
        eligible: s.approved && distinct >= minAthletes,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.gymName.localeCompare(b.gymName));

  const unallocatedPointsByEvent: Record<string, number> = {};
  for (const [k, v] of Object.entries(unallocatedByEvent)) unallocatedPointsByEvent[k] = round2(v);

  return {
    gyms: mergedGyms,
    unallocatedPointsByEvent,
    minAthletes,
    enabled: series.community_cup_enabled ?? false,
    eventIds,
  };
}

export type { TeamPlacement };
