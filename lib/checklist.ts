export type CheckItem = { label: string; ok: boolean; detail?: string };

export type ChecklistEvent = {
  venue_name: string | null;
  venue_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  waiver_text: string | null;
};

export type ChecklistDivision = {
  id: string;
  name: string;
  lane_count: number | null;
  heat_duration_minutes: number | null;
  price_normal: number;
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

export function computeDivisionChecks(
  divisions: ChecklistDivision[]
): (CheckItem & { divisionName: string })[] {
  return divisions.flatMap((d) => [
    { divisionName: d.name, label: "Lane count set", ok: !!d.lane_count },
    { divisionName: d.name, label: "Heat duration set", ok: !!d.heat_duration_minutes },
    { divisionName: d.name, label: "Price set", ok: d.price_normal > 0, detail: `R${d.price_normal}` },
  ]);
}

export function computeAllChecks(event: ChecklistEvent | null, divisions: ChecklistDivision[]): CheckItem[] {
  return [...computeEventChecks(event, divisions), ...computeDivisionChecks(divisions)];
}
