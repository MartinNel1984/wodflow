import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BrandKitLogo } from "@/components/BrandKitLogo";

// Tjokkie's feedback (2026-08-12): athletes who've entered more than
// one Rumble event should be able to pick which one's leaderboard to
// view, not just get deep-linked to their single most recent
// registration. Athletes with exactly one registration still land
// straight on it — same fast path as before, no picker in the way.
export default async function LeaderboardPickerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: myRows } = await supabase
    .from("registration_athletes")
    .select(
      "registrations(division_id, divisions(name, events(id, name, start_date, brand_kits(name, logo_url))))"
    )
    .eq("profile_id", user.id);

  type MyLeaderboard = {
    divisionId: string;
    divisionName: string;
    eventId: string;
    eventName: string;
    eventStartDate: string;
    brandKit: { name: string; logo_url: string | null } | null;
  };

  const myLeaderboards: MyLeaderboard[] = (myRows ?? [])
    .map((row): MyLeaderboard | null => {
      const reg = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
      if (!reg) return null;
      const division = Array.isArray(reg.divisions) ? reg.divisions[0] : reg.divisions;
      const event = Array.isArray(division?.events) ? division.events[0] : division?.events;
      if (!division || !event) return null;
      const brandKit = Array.isArray(event.brand_kits) ? event.brand_kits[0] : event.brand_kits;
      return {
        divisionId: reg.division_id,
        divisionName: division.name,
        eventId: event.id,
        eventName: event.name,
        eventStartDate: event.start_date,
        brandKit: brandKit ?? null,
      };
    })
    .filter((r): r is MyLeaderboard => r !== null)
    // De-dupe: an athlete only ever has one registration per event, but
    // guard anyway rather than trust that invariant here.
    .filter((r, i, arr) => arr.findIndex((x) => x.eventId === r.eventId) === i)
    .sort((a, b) => b.eventStartDate.localeCompare(a.eventStartDate));

  if (myLeaderboards.length === 0) return null;
  if (myLeaderboards.length === 1) {
    redirect(`/leaderboard/${myLeaderboards[0].divisionId}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-paper">Your Leaderboards</h1>
      <div className="grid grid-cols-2 gap-4">
        {myLeaderboards.map((lb) => (
          <Link
            key={lb.eventId}
            href={`/leaderboard/${lb.divisionId}`}
            className="bg-white border-2 border-ink rounded-xl px-4 py-6 flex flex-col items-center gap-2 text-center hover-lift"
          >
            <BrandKitLogo kit={lb.brandKit} className="h-14 object-contain" />
            <p className="font-semibold text-sm text-ink">{lb.eventName}</p>
            <p className="text-ink/50 text-xs">{lb.divisionName}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
