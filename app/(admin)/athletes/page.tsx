import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import AthletesTable, { type AthleteRow } from "./AthletesTable";
import { addAthleteManually, removeAthlete } from "../events/[eventId]/divisions/[divisionId]/athletes/actions";

export default async function AthletesDirectoryPage() {
  const supabase = await createClient();
  const { organizationId } = await requireOrganizer();

  const [{ data }, { data: divisionOptions }] = await Promise.all([
    supabase
      .from("registration_athletes")
      .select(
        "id, full_name, id_number, is_minor, waiver_signed_at, registrations(payment_status, division_id, divisions(id, name, event_id, events(name)))"
      )
      .order("waiver_signed_at", { ascending: false }),
    supabase
      .from("divisions")
      .select("id, name, events!inner(name, organization_id)")
      .eq("events.organization_id", organizationId)
      .order("name", { ascending: true }),
  ]);

  const rows: AthleteRow[] = (data ?? [])
    .map((a) => {
      const reg = Array.isArray(a.registrations) ? a.registrations[0] : a.registrations;
      const division = Array.isArray(reg?.divisions) ? reg.divisions[0] : reg?.divisions;
      const event = Array.isArray(division?.events) ? division.events[0] : division?.events;
      if (!division || !event) return null;
      return {
        id: a.id,
        fullName: a.full_name,
        idNumber: a.id_number,
        isMinor: a.is_minor,
        waiverSignedAt: a.waiver_signed_at,
        paymentStatus: reg?.payment_status ?? "pending",
        eventName: event.name,
        divisionName: division.name,
        waiverHref: `/events/${division.event_id}/divisions/${division.id}/athletes/${a.id}/waiver`,
      };
    })
    .filter((r): r is AthleteRow => r !== null);

  const divisions = (divisionOptions ?? []).map((d) => ({
    id: d.id,
    label: `${d.name} (${(d.events as unknown as { name: string })?.name})`,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Athletes</h1>
        <p className="text-ink/60 text-sm mt-1">
          Every athlete registered across every event — {rows.length} total.
        </p>
      </div>
      <AthletesTable
        rows={rows}
        divisions={divisions}
        addAthleteAction={addAthleteManually}
        removeAthleteAction={removeAthlete}
      />
    </div>
  );
}
