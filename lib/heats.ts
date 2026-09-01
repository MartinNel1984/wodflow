// Pure, unit-testable heat-generation logic — no DB access here, so it
// can be exercised directly against hand-worked edge cases before ever
// touching a database.
//
// Split into two steps (Tjokkie, 2026-09-01): building the blank heat
// schedule (slots + timing, no athletes) and assigning the roster into
// an existing schedule are separate operations, so an athlete can see
// roughly when they compete before teams are actually seeded into lanes.

export type RosterEntry = {
  registrationId: string;
  registrationOrder: number;
  // Rank from a prior workout, if this is a re-seed between rounds.
  // Lower number = better (rank 1 is best). null = no prior score yet.
  seedRank: number | null;
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

export type HeatScheduleInput = {
  laneCount: number;
  heatDurationMinutes: number;
  transitionMinutes: number;
  startTime: Date;
  rosterSize: number;
};

// Step 1: blank heat slots — timing only, no assignments. Heat count is
// derived from how many athletes need to fit, but which heat is the
// short one isn't decided here (see assignRosterToHeats) since that's a
// seeding decision, not a scheduling one.
export function buildHeatSchedule(input: HeatScheduleInput): HeatDraft[] {
  const { laneCount, heatDurationMinutes, transitionMinutes, startTime, rosterSize } = input;

  if (laneCount <= 0) throw new Error("laneCount must be greater than 0");
  if (heatDurationMinutes <= 0) throw new Error("heatDurationMinutes must be greater than 0");
  if (rosterSize <= 0) throw new Error("No athletes to schedule heats for.");

  const heatCount = Math.ceil(rosterSize / laneCount);
  const slotMs = (heatDurationMinutes + transitionMinutes) * 60_000;

  const heats: HeatDraft[] = [];
  for (let h = 0; h < heatCount; h++) {
    const heatNumber = h + 1;
    const heatStart = new Date(startTime.getTime() + h * slotMs);
    const heatEnd = new Date(heatStart.getTime() + heatDurationMinutes * 60_000);
    heats.push({ heatNumber, startTime: heatStart, endTime: heatEnd });
  }
  return heats;
}

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

export type HeatAssignInput = {
  laneCount: number;
  roster: RosterEntry[];
  // Heat numbers of the already-created schedule (from buildHeatSchedule),
  // in any order — sorted internally before filling.
  heatNumbers: number[];
};

// Step 2: fills an existing blank schedule with the roster, in seeded or
// registration order. Never creates or resizes heats — if the roster
// doesn't fit the existing schedule, that's a sign the schedule needs
// regenerating (roster count changed since step 1), not something this
// function should silently paper over.
export function assignRosterToHeats(input: HeatAssignInput): AssignmentDraft[] {
  const { laneCount, roster, heatNumbers } = input;

  if (laneCount <= 0) throw new Error("laneCount must be greater than 0");

  const sortedHeatNumbers = [...heatNumbers].sort((a, b) => a - b);
  const ordered = orderRoster(roster);
  const capacity = sortedHeatNumbers.length * laneCount;
  if (ordered.length > capacity) {
    throw new Error(
      `${ordered.length} athlete${ordered.length === 1 ? "" : "s"} need to be placed but the heat ` +
        `schedule only has room for ${capacity} — regenerate the heat schedule first.`
    );
  }

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

  const assignments: AssignmentDraft[] = [];
  let cursor = 0;
  sortedHeatNumbers.forEach((heatNumber, h) => {
    const size = h === 0 ? firstHeatSize : laneCount;
    const slice = ordered.slice(cursor, cursor + size);
    cursor += size;
    slice.forEach((entry, i) => {
      assignments.push({ heatNumber, registrationId: entry.registrationId, laneNumber: i + 1 });
    });
  });

  return assignments;
}
