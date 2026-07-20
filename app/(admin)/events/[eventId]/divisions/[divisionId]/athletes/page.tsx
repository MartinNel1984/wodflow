import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AthletesPage({
  params,
}: {
  params: Promise<{ eventId: string; divisionId: string }>;
}) {
  const { eventId, divisionId } = await params;
  const supabase = await createClient();

  const [{ data: division }, { data: registrations }] = await Promise.all([
    supabase.from("divisions").select("name").eq("id", divisionId).single(),
    supabase
      .from("registrations")
      .select(
        "id, team_name, payment_status, registration_athletes(id, full_name, id_number, is_minor, waiver_signed_name, waiver_signed_at)"
      )
      .eq("division_id", divisionId)
      .order("created_at", { ascending: true }),
  ]);

  const athletes = (registrations ?? []).flatMap((r) =>
    (r.registration_athletes ?? []).map((a) => ({
      ...a,
      teamName: r.team_name,
      paymentStatus: r.payment_status,
    }))
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <a href={`/events/${eventId}/divisions`} className="text-accent text-sm hover:underline">
          ← Divisions
        </a>
        <h1 className="text-2xl font-semibold mt-1">{division?.name ?? "Division"} — Athletes</h1>
      </div>

      <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink/5 text-left">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">ID number</th>
              <th className="px-4 py-2">Waiver</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {athletes.map((a) => (
              <tr key={a.id} className="border-t border-ink/10">
                <td className="px-4 py-2">
                  {a.full_name}
                  {a.is_minor && (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-accent">
                      Minor
                    </span>
                  )}
                  {a.teamName && <span className="ml-2 text-ink/40 text-xs">({a.teamName})</span>}
                </td>
                <td className="px-4 py-2 font-data">{a.id_number || "—"}</td>
                <td className="px-4 py-2">
                  {a.waiver_signed_at ? (
                    <span className="text-green-700">✓ Signed</span>
                  ) : (
                    <span className="text-amber-700 font-semibold">Not signed</span>
                  )}
                </td>
                <td className="px-4 py-2 capitalize">{a.paymentStatus}</td>
                <td className="px-4 py-2 text-right">
                  {a.waiver_signed_at && (
                    <Link
                      href={`/events/${eventId}/divisions/${divisionId}/athletes/${a.id}/waiver`}
                      className="text-accent text-xs font-semibold hover:underline"
                    >
                      View waiver
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {athletes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/60 text-sm">
                  No registrations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
