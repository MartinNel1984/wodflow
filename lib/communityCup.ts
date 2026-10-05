import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pointsForPosition, type ScoringConfig } from "@/lib/leaderboard";
import { fetchSeriesTeamPlacements, type TeamPlacement } from "@/lib/eventTeamPlacements";
import { computeSeriesStandingsForEvents } from "@/lib/seriesStandings";
import { createServiceClient } from "@/lib/supabase/service";

// A single credit toward a gym's total. Drill-down UI renders these so
// Tjokkie (or any gym owner looking at the public page) can see exactly
// how a gym's points were built up — "Team Smashers placed 3rd / 25 →
// 60 pts × 2 of 4 roster slots = 30 pts to ATG Bryanston".
export type GymEventContribution =
  | {
      kind: "team";
      teamName: string;
      position: number;
      entrants: number;
      teamSize: number;
      slotsFromThisGym: number;
      athleteNames: string[];
      seriesPointsForTeam: number;
      pointsCredited: number;
    }
  | {
      kind: "historical";
      athleteName: string;
      position: number;
      entrants: number;
      pointsCredited: number;
    };

// A single gym's rank across the full series. The admin page needs
// to see below-threshold gyms too (hence the eligible flag), the
// public page only renders eligible=true rows.
export type GymStanding = {
  gymId: string | null; // null for pending-but-not-approved writes
  gymName: string;
  approved: boolean;
  totalPoints: number;
  pointsByEvent: Record<string, number>;
  contributionsByEvent: Record<string, GymEventContribution[]>;
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

  // --- 2. Rosters (teammate → gym_name, with full_name for drill-down
  //        attribution) for every placed team, from the anon-safe view
  //        updated in migration-092.
  const allRegistrationIds = [...new Set(teamPlacements.map((t) => t.registrationId))];
  const { data: rosterRows } = await supabase
    .from("public_registration_gyms")
    .select("registration_id, profile_id, full_name, gym_name")
    .in("registration_id", allRegistrationIds);

  const rosterByRegistration = new Map<
    string,
    { profile_id: string | null; full_name: string | null; gym_name: string }[]
  >();
  for (const r of rosterRows ?? []) {
    const arr = rosterByRegistration.get(r.registration_id) ?? [];
    arr.push({ profile_id: r.profile_id, full_name: r.full_name, gym_name: r.gym_name });
    rosterByRegistration.set(r.registration_id, arr);
  }

  // --- 3. Gyms master list — canonical names + approval status.
  //        Pending gyms get their contributions held (admin page shows
  //        the aggregate but public page excludes them).
  const { data: gymRows } = await supabase.from("gyms").select("id, name, approved");
  const canonicalByKey = new Map<string, { id: string; name: string; approved: boolean }>();
  for (const g of gymRows ?? []) {
    const key = gymKey(g.name);
    if (key) canonicalByKey.set(key, g);
  }

  // --- 4. Allocate: for each team placement, split that team's series
  //        points across its athletes' gyms in proportion to team_size.
  //        Blank/unknown-gym slots leave their share unallocated.
  type Bucket = {
    gymId: string | null;
    gymName: string;
    approved: boolean;
    totalPoints: number;
    pointsByEvent: Record<string, number>;
    contributionsByEvent: Record<string, GymEventContribution[]>;
    profileIds: Set<string>;
  };
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
        contributionsByEvent: {},
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

    // Group roster entries by canonical gym key for this team so each
    // gym gets ONE contribution row (slotsFromThisGym counts the shared
    // slots) rather than one row per teammate.
    const slotsByGym = new Map<
      string,
      { displayName: string; athleteNames: string[]; profileIds: string[] }
    >();
    let allocatedSlots = 0;
    for (const slot of roster) {
      const key = gymKey(slot.gym_name);
      if (!key) continue;
      const entry = slotsByGym.get(key) ?? {
        displayName: slot.gym_name.trim(),
        athleteNames: [],
        profileIds: [],
      };
      if (slot.full_name) entry.athleteNames.push(slot.full_name);
      if (slot.profile_id) entry.profileIds.push(slot.profile_id);
      slotsByGym.set(key, entry);
      allocatedSlots += 1;
    }

    for (const [key, entry] of slotsByGym.entries()) {
      const slots = entry.athleteNames.length || entry.profileIds.length || 1;
      // slots can mis-count when the roster has an unnamed teammate with
      // a gym but no profile/full_name; fall back to recomputing via a
      // second pass is overkill — rare in practice. The accurate slot
      // count comes from how many roster entries landed in this bucket.
      // Recompute properly:
      const accurateSlots = (() => {
        let n = 0;
        for (const slot of roster) {
          if (gymKey(slot.gym_name) === key) n += 1;
        }
        return n || slots;
      })();
      const pointsCredited = perSlotShare * accurateSlots;
      const bucket = bucketFor(key, entry.displayName);
      bucket.totalPoints += pointsCredited;
      bucket.pointsByEvent[t.eventName] =
        (bucket.pointsByEvent[t.eventName] ?? 0) + pointsCredited;
      const list = bucket.contributionsByEvent[t.eventName] ?? [];
      list.push({
        kind: "team",
        teamName: t.displayName,
        position: t.position,
        entrants: t.entrants,
        teamSize: t.teamSize,
        slotsFromThisGym: accurateSlots,
        athleteNames: entry.athleteNames,
        seriesPointsForTeam: round2(seriesPoints),
        pointsCredited: round2(pointsCredited),
      });
      bucket.contributionsByEvent[t.eventName] = list;
      for (const pid of entry.profileIds) bucket.profileIds.add(pid);
    }

    const totalSlots = Math.max(roster.length, t.teamSize);
    const unallocatedSlots = totalSlots - allocatedSlots;
    if (unallocatedSlots > 0) {
      unallocated[t.eventName] =
        (unallocated[t.eventName] ?? 0) + unallocatedSlots * perSlotShare;
    }
  }

  // --- 5. Shape the result (and sort contributions biggest-first so
  //        drill-down UX leads with the heaviest hitters).
  const gyms: GymStanding[] = [...buckets.values()]
    .map((b) => {
      const roundedByEvent: Record<string, number> = {};
      for (const [k, v] of Object.entries(b.pointsByEvent)) roundedByEvent[k] = round2(v);
      const sortedContributions: Record<string, GymEventContribution[]> = {};
      for (const [k, list] of Object.entries(b.contributionsByEvent)) {
        sortedContributions[k] = [...list].sort((a, b) => b.pointsCredited - a.pointsCredited);
      }
      const distinct = b.profileIds.size;
      return {
        gymId: b.gymId,
        gymName: b.gymName,
        approved: b.approved,
        totalPoints: round2(b.totalPoints),
        pointsByEvent: roundedByEvent,
        contributionsByEvent: sortedContributions,
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

  const liveEventNames = new Set<string>();
  if (eventIds.length > 0) {
    const { data: liveEvents } = await supabase
      .from("events")
      .select("name")
      .in("id", eventIds);
    for (const e of liveEvents ?? []) liveEventNames.add(e.name);
  }

  // Historical rows carry a position/entrants/display_name per athlete.
  // We need to pass that attribution through so the drill-down can
  // render "Jane Doe · 4th / 150 — 85 pts" per historical finish, not
  // just a lump per event.
  type HistoricalContribution = {
    profileId: string | null;
    unclaimedIdentityHash: string | null;
    displayName: string;
    eventName: string;
    position: number;
    entrants: number;
    points: number;
  };
  const historicalContribs: HistoricalContribution[] = [];
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const s of seriesStandings) {
    const claimedProfileId = uuidPattern.test(s.profileId) ? s.profileId : null;
    const unclaimedHash = !claimedProfileId && s.profileId.startsWith("identity:")
      ? s.profileId.slice("identity:".length)
      : null;
    for (const placement of s.placements ?? []) {
      if (liveEventNames.has(placement.eventName)) continue;
      if (!placement.points) continue;
      historicalContribs.push({
        profileId: claimedProfileId,
        unclaimedIdentityHash: unclaimedHash,
        // Per-placement name — SeriesStanding's own displayName locks
        // in on the first placement, which for an athlete who also ran
        // a live Big One team was the TEAM name. The historical row's
        // own display_name is the right label for a historical line.
        displayName: placement.displayName,
        eventName: placement.eventName,
        position: placement.position,
        entrants: placement.entrants,
        points: placement.points,
      });
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
  const emailByProfile = new Map<string, string | null>();
  if (claimedProfileIds.length > 0) {
    const svc = createServiceClient();
    const { data: profiles } = await svc
      .from("profiles")
      .select("id, gym_name, email")
      .in("id", claimedProfileIds);
    for (const p of profiles ?? []) {
      gymByProfile.set(p.id, p.gym_name);
      if (p.email) emailByProfile.set(p.id, p.email.toLowerCase());
    }
  }

  // Per-row gym override from historical_results.gym_name. If Tjokkie
  // sets a gym on a historical row, that wins over the profile gym —
  // lets him manually fix attribution on a per-row basis (e.g. an
  // athlete whose Wodflow profile has moved gyms since Indy was run,
  // but whose Indy result still belongs to the old gym). Keyed by
  // (event_name, identity_hash) — identity_hash is md5(lower(email)),
  // matching public_historical_placements, so it works for both
  // claimed and unclaimed finishers.
  const svc = createServiceClient();
  const { data: historicalRows } = await svc
    .from("historical_results")
    .select("event_name, athlete_email, gym_name, season_year")
    .not("gym_name", "is", null);
  const overrideByEventIdentity = new Map<string, string>();
  for (const r of historicalRows ?? []) {
    if (seasonYear !== null && r.season_year !== seasonYear) continue;
    if (!r.gym_name || !r.athlete_email) continue;
    const hash = createHash("md5").update(r.athlete_email.toLowerCase()).digest("hex");
    const key = `${r.event_name}::${hash}`;
    overrideByEventIdentity.set(key, r.gym_name);
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
    contributionsByEvent: Record<string, GymEventContribution[]>;
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
      contributionsByEvent: Object.fromEntries(
        Object.entries(g.contributionsByEvent).map(([k, v]) => [k, [...v]])
      ),
      profileIds: new Set<string>(),
    });
  }

  const unallocatedByEvent: Record<string, number> = { ...result.unallocatedPointsByEvent };

  const liveDistinctByKey = new Map<string, number>();
  for (const g of result.gyms) {
    liveDistinctByKey.set(g.gymName.trim().toLowerCase(), g.distinctAthleteCount);
  }

  const historicalProfileIdsByKey = new Map<string, Set<string>>();

  for (const c of historicalContribs) {
    // Row-level override wins (claimed OR unclaimed) — Tjokkie's edits
    // to a historical row's gym must actually move points. Fall back
    // to the claimed profile's current gym, then to unallocated.
    let identityHash: string | null = c.unclaimedIdentityHash;
    if (!identityHash && c.profileId) {
      const email = emailByProfile.get(c.profileId);
      if (email) identityHash = createHash("md5").update(email).digest("hex");
    }
    const overrideKey = identityHash ? `${c.eventName}::${identityHash}` : null;
    const overrideGym = overrideKey ? overrideByEventIdentity.get(overrideKey) ?? null : null;
    const profileGym = c.profileId ? gymByProfile.get(c.profileId) ?? null : null;
    const gymName = overrideGym ?? profileGym;
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
        contributionsByEvent: {},
        profileIds: new Set<string>(),
      };
      standingByKey.set(key, standing);
    }
    standing.totalPoints += c.points;
    standing.pointsByEvent[c.eventName] = (standing.pointsByEvent[c.eventName] ?? 0) + c.points;
    const list = standing.contributionsByEvent[c.eventName] ?? [];
    list.push({
      kind: "historical",
      athleteName: c.displayName,
      position: c.position,
      entrants: c.entrants,
      pointsCredited: round2(c.points),
    });
    standing.contributionsByEvent[c.eventName] = list;
    if (c.profileId) {
      const seen = historicalProfileIdsByKey.get(key) ?? new Set<string>();
      seen.add(c.profileId);
      historicalProfileIdsByKey.set(key, seen);
    }
  }

  const mergedGyms: GymStanding[] = [...standingByKey.entries()]
    .map(([key, s]) => {
      const roundedByEvent: Record<string, number> = {};
      for (const [k, v] of Object.entries(s.pointsByEvent)) roundedByEvent[k] = round2(v);
      const sortedContributions: Record<string, GymEventContribution[]> = {};
      for (const [k, list] of Object.entries(s.contributionsByEvent)) {
        sortedContributions[k] = [...list].sort((a, b) => b.pointsCredited - a.pointsCredited);
      }
      const historicalCount = historicalProfileIdsByKey.get(key)?.size ?? 0;
      const liveCount = liveDistinctByKey.get(key) ?? 0;
      const distinct = liveCount + historicalCount;
      return {
        gymId: s.gymId,
        gymName: s.gymName,
        approved: s.approved,
        totalPoints: round2(s.totalPoints),
        pointsByEvent: roundedByEvent,
        contributionsByEvent: sortedContributions,
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
