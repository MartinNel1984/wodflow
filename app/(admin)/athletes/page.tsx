import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import AthletesTable, { type AthleteRow } from "./AthletesTable";
import {
  addAthleteManually,
  removeAthlete,
  resendPaymentLink,
} from "../events/[eventId]/divisions/[divisionId]/athletes/actions";

export default async function AthletesDirectoryPage() {
  const supabase = await createClient();
  const { organizationId } = await requireOrganizer();

  const [{ data }, { data: divisionOptions }, { data: eventDivisions }] = await Promise.all([
    supabase
      .from("registration_athletes")
      .select(
        "id, full_name, id_number, is_minor, waiver_signed_at, is_captain, registrations(id, payment_status, division_id, team_name, divisions(id, name, event_id, events(name)))"
      )
      .order("waiver_signed_at", { ascending: false }),
    supabase
      .from("divisions")
      .select("id, name, team_size, events!inner(name, organization_id)")
      .eq("events.organization_id", organizationId)
      .order("name", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, start_date, divisions(id, name)")
      .eq("organization_id", organizationId)
      .order("start_date", { ascending: false }),
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
        teamName: reg?.team_name ?? null,
        isMinor: a.is_minor,
        waiverSignedAt: a.waiver_signed_at,
        paymentStatus: reg?.payment_status ?? "pending",
        eventName: event.name,
        divisionName: division.name,
        waiverHref: `/events/${division.event_id}/divisions/${division.id}/athletes/${a.id}/waiver`,
        registrationId: reg?.id ?? null,
        isCaptain: a.is_captain,
      };
    })
    .filter((r): r is AthleteRow => r !== null);

  const divisions = (divisionOptions ?? []).map((d) => ({
    id: d.id,
    label: `${d.name} (${(d.events as unknown as { name: string })?.name})`,
    teamSize: d.team_size ?? 1,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Athletes</h1>
        <p className="text-ink/60 text-sm mt-1">
          Every athlete registered across every event — {rows.length} total.
        </p>
      </div>

      {/* Direct jump to a division's own Athletes page — same picker
          pattern as /leaderboards and /workouts — so manually adding a
          team (Team name + Athlete 1/2 fields) doesn't require using
          the flat division dropdown in the form further down. */}
      <div className="space-y-4">
        <h2 className="font-semibold">Jump to a division</h2>
        {(eventDivisions ?? []).map((e) => (
          <div key={e.id} className="bg-white border border-ink/10 rounded-xl p-4">
            <p className="font-semibold">{e.name}</p>
            <p className="text-ink/60 text-sm mb-3">{e.start_date}</p>
            <div className="flex flex-wrap gap-2">
              {(e.divisions ?? []).map((d) => (
                <Link
                  key={d.id}
                  href={`/events/${e.id}/divisions/${d.id}/athletes`}
                  className="bg-paper border border-ink/10 rounded-lg px-3 py-1.5 text-sm hover:bg-ink/5"
                >
                  {d.name} →
                </Link>
              ))}
              {(e.divisions ?? []).length === 0 && (
                <p className="text-ink/40 text-sm">No divisions yet.</p>
              )}
            </div>
          </div>
        ))}
        {(!eventDivisions || eventDivisions.length === 0) && (
          <p className="text-ink/60 text-sm">No events yet.</p>
        )}
      </div>

      <AthletesTable
        rows={rows}
        divisions={divisions}
        addAthleteAction={addAthleteManually}
        removeAthleteAction={removeAthlete}
        resendPaymentLinkAction={resendPaymentLink}
      />
    </div>
  );
}
