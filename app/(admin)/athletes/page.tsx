import { createClient } from "@/lib/supabase/server";
import AthletesTable, { type AthleteRow } from "./AthletesTable";

export default async function AthletesDirectoryPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("registration_athletes")
    .select(
      "id, full_name, id_number, is_minor, waiver_signed_at, registrations(payment_status, division_id, divisions(id, name, event_id, events(name)))"
    )
    .order("waiver_signed_at", { ascending: false });

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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Athletes</h1>
        <p className="text-ink/60 text-sm mt-1">
          Every athlete registered across every event — {rows.length} total.
        </p>
      </div>
      <AthletesTable rows={rows} />
    </div>
  );
}
