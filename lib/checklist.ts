export type CheckItem = { label: string; ok: boolean; detail?: string };

export type ChecklistEvent = {
  venue_name: string | null;
  venue_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  waiver_text: string | null;
};

export type ChecklistWorkout = {
  id: string;
  name: string;
  lane_count: number | null;
  heat_duration_minutes: number | null;
};

export type ChecklistDivision = {
  id: string;
  name: string;
  price_normal: number;
  workouts: ChecklistWorkout[];
};

// Pulled out of the checklist page so the dashboard's health rollup
// (Milestone 16) reads the exact same pass/fail logic instead of a
// second, driftable copy.
export function computeEventChecks(event: ChecklistEvent | null, divisions: ChecklistDivision[]): CheckItem[] {
  return [
    { label: "Venue name set", ok: !!event?.venue_name },
    { label: "Venue address set", ok: !!event?.venue_address },
    { label: "Contact email set", ok: !!event?.contact_email },
    { label: "Contact phone set", ok: !!event?.contact_phone },
    { label: "Waiver text set", ok: !!event?.waiver_text },
    { label: "At least one division exists", ok: divisions.length > 0 },
  ];
}

// Grouped by divisionId (stable), not name — two divisions in the same
// event sharing a display name (a duplicate, or one renamed to match
// another) would otherwise merge/duplicate each other's checklist items
// under a name-based filter, giving a false "ready to go" or wrong
// missing-item picture right before an event.
export function computeDivisionChecks(
  divisions: ChecklistDivision[]
): (CheckItem & { divisionId: string })[] {
  return divisions.flatMap((d) => [
    { divisionId: d.id, label: "Price set", ok: d.price_normal > 0, detail: `R${d.price_normal}` },
    { divisionId: d.id, label: "At least one workout exists", ok: d.workouts.length > 0 },
    ...d.workouts.flatMap((w) => [
      { divisionId: d.id, label: `${w.name}: lane count set`, ok: !!w.lane_count },
      { divisionId: d.id, label: `${w.name}: heat duration set`, ok: !!w.heat_duration_minutes },
    ]),
  ]);
}

export function computeAllChecks(event: ChecklistEvent | null, divisions: ChecklistDivision[]): CheckItem[] {
  return [...computeEventChecks(event, divisions), ...computeDivisionChecks(divisions)];
}
