import { createClient } from "@/lib/supabase/server";
import PrintButton from "../../divisions/[divisionId]/athletes/[athleteId]/waiver/PrintButton";

export default async function AllWaiversPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: registrations }] = await Promise.all([
    supabase.from("events").select("name").eq("id", eventId).single(),
    supabase
      .from("registrations")
      .select(
        "team_name, registration_athletes(id, full_name, email, id_number, is_minor, guardian_name, guardian_id_number, waiver_signed_name, waiver_signed_at, waiver_ip, waiver_text_snapshot)"
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
  ]);

  const athletes = (registrations ?? []).flatMap((r) =>
    (r.registration_athletes ?? [])
      .filter((a) => a.waiver_signed_at)
      .map((a) => ({ ...a, teamName: r.team_name }))
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="no-print flex justify-between items-center">
        <a href={`/events/${eventId}/divisions`} className="text-accent text-sm hover:underline">
          ← Divisions
        </a>
        <PrintButton />
      </div>

      <h1 className="text-xl font-semibold no-print">
        {event?.name ?? "Event"} — All Signed Waivers ({athletes.length})
      </h1>

      {athletes.map((a, i) => (
        <div
          key={a.id}
          className="bg-white border border-ink/10 rounded-xl p-8 space-y-6 print:border-0 print:shadow-none"
          style={i > 0 ? { breakBefore: "page" } : undefined}
        >
          <div>
            <h2 className="text-lg font-semibold">{event?.name ?? "Event"} — Signed Waiver</h2>
            {a.teamName && <p className="text-ink/60 text-sm">Team: {a.teamName}</p>}
          </div>

          <table className="w-full text-sm">
            <tbody>
              <Row label="Full name" value={a.full_name} />
              <Row label="Email" value={a.email} />
              <Row label="ID number" value={a.id_number ?? "—"} />
              {a.is_minor && (
                <>
                  <Row label="Minor" value="Yes" />
                  <Row label="Parent/guardian" value={a.guardian_name ?? "—"} />
                  <Row label="Parent/guardian ID number" value={a.guardian_id_number ?? "—"} />
                </>
              )}
            </tbody>
          </table>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/50 mb-2">
              Waiver text agreed to
            </h3>
            <div className="text-sm whitespace-pre-wrap border border-ink/10 rounded-lg p-4 bg-paper">
              {a.waiver_text_snapshot || "No waiver text was set for this event at signup time."}
            </div>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <Row label="Signed by" value={a.waiver_signed_name ?? "—"} />
              <Row
                label="Signed at"
                value={a.waiver_signed_at ? new Date(a.waiver_signed_at).toLocaleString() : "—"}
              />
              <Row label="IP address" value={a.waiver_ip ?? "—"} />
            </tbody>
          </table>
        </div>
      ))}

      {athletes.length === 0 && (
        <p className="text-ink/60 text-sm text-center py-10">No signed waivers yet for this event.</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-ink/5">
      <td className="py-1.5 pr-4 text-ink/50 w-48">{label}</td>
      <td className="py-1.5 font-semibold">{value}</td>
    </tr>
  );
}
