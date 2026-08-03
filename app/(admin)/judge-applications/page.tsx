import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import Link from "next/link";

// Same jump-off pattern as /leaderboards and /workouts — a direct nav
// entry to an event's judge applicant list.
export default async function JudgeApplicationsPickerPage() {
  const supabase = await createClient();
  const { organizationId } = await requireOrganizer();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Judge Signups</h1>

      <div className="space-y-3">
        {(events ?? []).map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}/judge-applications`}
            className="flex items-center justify-between bg-white border border-ink/10 rounded-xl p-4 hover:bg-ink/5"
          >
            <div>
              <p className="font-semibold">{e.name}</p>
              <p className="text-ink/60 text-sm">{e.start_date}</p>
            </div>
            <span className="text-accent text-sm font-semibold">View applicants →</span>
          </Link>
        ))}
        {(!events || events.length === 0) && <p className="text-ink/60 text-sm">No events yet.</p>}
      </div>
    </div>
  );
}
