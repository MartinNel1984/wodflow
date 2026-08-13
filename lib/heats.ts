// Pure, unit-testable heat-generation logic — no DB access here, so it
// can be exercised directly against hand-worked edge cases before ever
// touching a database.

export type RosterEntry = {
  registrationId: string;
  registrationOrder: number;
  // Rank from a prior workout, if this is a re-seed between rounds.
  // Lower number = better (rank 1 is best). null = no prior score yet.
  seedRank: number | null;
};

export type HeatGenInput = {
  laneCount: number;
  heatDurationMinutes: number;
  transitionMinutes: number;
  startTime: Date;
  roster: RosterEntry[];
};

export type HeatDraft = {
  heatNumber: number;
  startTime: Date;
  endTime: Date;
};

export type AssignmentDraft = {
  heatNumber: number;
  registrationId: string;
  laneNumber: number;
};

export type HeatGenResult = {
  heats: HeatDraft[];
  assignments: AssignmentDraft[];
};

// Orders the roster so unseeded athletes (no prior score — e.g. workout 1)
// fill the earliest heats in registration order, then seeded athletes
// (re-seeding between rounds) fill the remaining heats worst-seed-first,
// so the strongest competitor lands in the final heat — standard
// competition convention that builds to the best heat last.
function orderRoster(roster: RosterEntry[]): RosterEntry[] {
  const unseeded = roster
    .filter((r) => r.seedRank == null)
    .sort((a, b) => a.registrationOrder - b.registrationOrder);

  const seeded = roster
    .filter((r) => r.seedRank != null)
    .sort((a, b) => (b.seedRank as number) - (a.seedRank as number));

  return [...unseeded, ...seeded];
}

export function generateHeats(input: HeatGenInput): HeatGenResult {
  const { laneCount, heatDurationMinutes, transitionMinutes, startTime, roster } = input;

  if (laneCount <= 0) throw new Error("laneCount must be greater than 0");
  if (heatDurationMinutes <= 0) throw new Error("heatDurationMinutes must be greater than 0");

  const ordered = orderRoster(roster);
  const heatCount = Math.ceil(ordered.length / laneCount);
  const slotMs = (heatDurationMinutes + transitionMinutes) * 60_000;

  // A division that isn't fully sold out (or loses a team to a
  // withdrawal) never divides evenly by laneCount — one heat has to be
  // the short one. Tjokkie (2026-08-13): that gap belongs in Heat 1,
  // not the final heat — a partial "show" heat at the end looks
  // unfinished on the day. Putting the leftover first and every heat
  // after it full-sized doesn't touch orderRoster's seeding at all:
  // since remainder + (heatCount-1)*laneCount always equals
  // ordered.length, the LAST heat still ends exactly on the tail of
  // `ordered` — where orderRoster already put the best-seeded
  // competitor — so "strongest heat last" for re-seeded rounds is
  // unaffected.
  const remainder = ordered.length % laneCount;
  const firstHeatSize = remainder === 0 ? laneCount : remainder;

  const heats: HeatDraft[] = [];
  const assignments: AssignmentDraft[] = [];

  let cursor = 0;
  for (let h = 0; h < heatCount; h++) {
    const heatNumber = h + 1;
    const heatStart = new Date(startTime.getTime() + h * slotMs);
    const heatEnd = new Date(heatStart.getTime() + heatDurationMinutes * 60_000);
    heats.push({ heatNumber, startTime: heatStart, endTime: heatEnd });

    const size = h === 0 ? firstHeatSize : laneCount;
    const slice = ordered.slice(cursor, cursor + size);
    cursor += size;
    slice.forEach((entry, i) => {
      assignments.push({ heatNumber, registrationId: entry.registrationId, laneNumber: i + 1 });
    });
  }

  return { heats, assignments };
}
