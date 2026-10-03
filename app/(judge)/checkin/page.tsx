import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Check-in" };

// Jump-to-scanner shortcut. The scanner lives per-event at
// /events/[eventId]/checkin — before this page, organizer/head_judge
// staff had to be sent the raw link each event (Tjokkie, 2026-10-03:
// Claudia opened the shared link without being logged in and bounced
// off the PIN prompt). Scoped to organizer + head_judge; plain judges
// have scanner access per migration-086 but keep using the link they
// get from the organizer for now — organizer explicitly limited the
// nav entry to those two roles.
export default async function CheckinLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/judge-login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  const role = profile?.role;
  const orgId = profile?.organization_id;

  if (role !== "organizer" && role !== "head_judge") {
    return (
      <p className="text-center py-20 text-ink/60 text-sm">
        Check-in is only available to organizers and head judges.
      </p>
    );
  }

  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date")
    .eq("organization_id", orgId)
    .eq("status", "live")
    .order("start_date", { ascending: true });

  const liveEvents = events ?? [];

  if (liveEvents.length === 1) {
    redirect(`/events/${liveEvents[0].id}/checkin`);
  }

  if (liveEvents.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-2">
        <h1 className="text-xl font-semibold">Check-in</h1>
        <p className="text-ink/60 text-sm">No live events right now.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-10 space-y-4">
      <h1 className="text-xl font-semibold text-center">Choose an event</h1>
      <ul className="space-y-2">
        {liveEvents.map((e) => (
          <li key={e.id}>
            <Link
              href={`/events/${e.id}/checkin`}
              className="block bg-white border border-ink/10 rounded-lg px-4 py-3 text-sm font-semibold hover:bg-ink/5"
            >
              {e.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
