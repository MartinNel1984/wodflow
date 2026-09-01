import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";

export default async function EventJudgeApplicationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { supabase } = await requireOrganizer();

  const [{ data: event }, { data: applications }] = await Promise.all([
    supabase.from("events").select("id, name").eq("id", eventId).single(),
    supabase
      .from("judge_applications")
      .select(
        "id, first_name, last_name, email, cell, tshirt_size, judged_before, competing_in_big_one, created_at"
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link href="/judge-applications" className="text-accent text-sm hover:underline">
          ← Judge Signups
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{event?.name ?? "Event"} — Judge applicants</h1>
      </div>

      <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink/5 text-left">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Cell</th>
              <th className="px-4 py-2">Shirt</th>
              <th className="px-4 py-2">Judged before</th>
              <th className="px-4 py-2">Competing at Big One</th>
              <th className="px-4 py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {(applications ?? []).map((a) => (
              <tr key={a.id} className="border-t border-ink/10">
                <td className="px-4 py-2 font-semibold">
                  {a.first_name} {a.last_name}
                </td>
                <td className="px-4 py-2 text-ink/70">{a.email}</td>
                <td className="px-4 py-2 text-ink/70">{a.cell}</td>
                <td className="px-4 py-2 text-ink/70">{a.tshirt_size}</td>
                <td className="px-4 py-2 text-ink/70">{a.judged_before ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-ink/70">{a.competing_in_big_one ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-ink/50 font-data">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {(!applications || applications.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-ink/60 text-sm">
                  No applications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
