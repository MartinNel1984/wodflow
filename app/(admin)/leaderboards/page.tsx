import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import Link from "next/link";

// Quick jump-off point to a division's public leaderboard — there was
// no way to reach it from the admin nav before, only by knowing/guessing
// the direct /leaderboard/[divisionId] URL.
export default async function LeaderboardsPage() {
  const supabase = await createClient();
  const { organizationId } = await requireOrganizer();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date, divisions(id, name)")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Leaderboards</h1>

      <div className="space-y-4">
        {(events ?? []).map((e) => (
          <div key={e.id} className="bg-white border border-ink/10 rounded-xl p-4">
            <p className="font-semibold">{e.name}</p>
            <p className="text-ink/60 text-sm mb-3">{e.start_date}</p>
            <div className="flex flex-wrap gap-2">
              {(e.divisions ?? []).map((d) => (
                <Link
                  key={d.id}
                  href={`/leaderboard/${d.id}`}
                  target="_blank"
                  className="bg-paper border border-ink/10 rounded-lg px-3 py-1.5 text-sm hover:bg-ink/5"
                >
                  {d.name} ↗
                </Link>
              ))}
              {(e.divisions ?? []).length === 0 && (
                <p className="text-ink/40 text-sm">No divisions yet.</p>
              )}
            </div>
          </div>
        ))}
        {(!events || events.length === 0) && <p className="text-ink/60 text-sm">No events yet.</p>}
      </div>
    </div>
  );
}
