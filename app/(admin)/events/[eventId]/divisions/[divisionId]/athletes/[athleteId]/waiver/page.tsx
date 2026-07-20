import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

export default async function WaiverPage({
  params,
}: {
  params: Promise<{ eventId: string; divisionId: string; athleteId: string }>;
}) {
  const { eventId, athleteId } = await params;
  const supabase = await createClient();

  const [{ data: athlete }, { data: event }] = await Promise.all([
    supabase
      .from("registration_athletes")
      .select(
        "full_name, email, id_number, is_minor, guardian_name, guardian_id_number, waiver_signed_name, waiver_signed_at, waiver_ip, waiver_text_snapshot, registrations(team_name)"
      )
      .eq("id", athleteId)
      .single(),
    supabase.from("events").select("name").eq("id", eventId).single(),
  ]);

  if (!athlete) notFound();

  const registration = Array.isArray(athlete.registrations) ? athlete.registrations[0] : athlete.registrations;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="no-print flex justify-between items-center">
        <a href="../.." className="text-accent text-sm hover:underline">
          ← Athletes
        </a>
        <PrintButton />
      </div>

      <div className="bg-white border border-ink/10 rounded-xl p-8 space-y-6 print:border-0 print:shadow-none">
        <div>
          <h1 className="text-xl font-semibold">{event?.name ?? "Event"} — Signed Waiver</h1>
          {registration?.team_name && <p className="text-ink/60 text-sm">Team: {registration.team_name}</p>}
        </div>

        <table className="w-full text-sm">
          <tbody>
            <Row label="Full name" value={athlete.full_name} />
            <Row label="Email" value={athlete.email} />
            <Row label="ID number" value={athlete.id_number ?? "—"} />
            {athlete.is_minor && (
              <>
                <Row label="Minor" value="Yes" />
                <Row label="Parent/guardian" value={athlete.guardian_name ?? "—"} />
                <Row label="Parent/guardian ID number" value={athlete.guardian_id_number ?? "—"} />
              </>
            )}
          </tbody>
        </table>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/50 mb-2">
            Waiver text agreed to
          </h2>
          <div className="text-sm whitespace-pre-wrap border border-ink/10 rounded-lg p-4 bg-paper">
            {athlete.waiver_text_snapshot || "No waiver text was set for this event at signup time."}
          </div>
        </div>

        <table className="w-full text-sm">
          <tbody>
            <Row label="Signed by" value={athlete.waiver_signed_name ?? "—"} />
            <Row
              label="Signed at"
              value={athlete.waiver_signed_at ? new Date(athlete.waiver_signed_at).toLocaleString() : "—"}
            />
            <Row label="IP address" value={athlete.waiver_ip ?? "—"} />
          </tbody>
        </table>
      </div>
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
