import { createClient } from "@/lib/supabase/server";
import { computeStandings, type LeaderboardRow, type ScoringConfig } from "@/lib/leaderboard";
import Link from "next/link";

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: myRows }, { data: upcomingEvents }] = await Promise.all([
    supabase
      .from("registration_athletes")
      .select(
        "id, registration_id, registrations(id, division_id, team_name, payment_status, divisions(id, name, scoring_config, events(id, name, start_date)))"
      )
      .eq("profile_id", user.id),
    supabase
      .from("events")
      .select("id, name, start_date, end_date, venue_name")
      .in("status", ["published", "live"])
      .order("start_date", { ascending: true }),
  ]);

  type MyRegistration = {
    registrationId: string;
    divisionId: string;
    divisionName: string;
    scoringConfig: ScoringConfig;
    eventId: string;
    eventName: string;
    eventStartDate: string;
    teamName: string | null;
    paymentStatus: string;
  };

  const myRegistrations: MyRegistration[] = (myRows ?? [])
    .map((row) => {
      const reg = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
      if (!reg) return null;
      const division = Array.isArray(reg.divisions) ? reg.divisions[0] : reg.divisions;
      const event = Array.isArray(division?.events) ? division.events[0] : division?.events;
      if (!division || !event) return null;
      return {
        registrationId: reg.id,
        divisionId: division.id,
        divisionName: division.name,
        scoringConfig: (division.scoring_config ?? { method: "rank_sum" }) as ScoringConfig,
        eventId: event.id,
        eventName: event.name,
        eventStartDate: event.start_date,
        teamName: reg.team_name,
        paymentStatus: reg.payment_status,
      };
    })
    .filter((r): r is MyRegistration => r !== null)
    .sort((a, b) => b.eventStartDate.localeCompare(a.eventStartDate));

  // Best finishes — for every division the athlete has actually
  // scored in, compute that division's real standings (using its own
  // scoring formula) and pull out this athlete's own placement.
  // Divisions with no scores yet are skipped (nothing to rank).
  const bestFinishes: { eventName: string; divisionName: string; position: number; total: number }[] = [];
  for (const reg of myRegistrations) {
    const { data: rows } = await supabase
      .from("public_leaderboard")
      .select("heat_assignment_id, workout_id, value_raw, registration_id, display_name, tiebreak_value")
      .eq("division_id", reg.divisionId);
    if (!rows || rows.length === 0) continue;
    const { standings } = computeStandings(rows as LeaderboardRow[], reg.scoringConfig);
    const idx = standings.findIndex((s) => s.registrationId === reg.registrationId);
    if (idx === -1) continue;
    bestFinishes.push({
      eventName: reg.eventName,
      divisionName: reg.divisionName,
      position: idx + 1,
      total: standings.length,
    });
  }
  bestFinishes.sort((a, b) => a.position - b.position);

  const registeredEventIds = new Set(myRegistrations.map((r) => r.eventId));
  const registerableEvents = (upcomingEvents ?? []).filter((e) => !registeredEventIds.has(e.id));

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">My Wodflow</h1>

      {bestFinishes.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">Best Finishes</h2>
          <div className="bg-white border border-ink/10 rounded-xl divide-y divide-ink/5">
            {bestFinishes.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{f.eventName}</p>
                  <p className="text-ink/60 text-xs">{f.divisionName}</p>
                </div>
                <p className="font-data font-bold text-accent">
                  {f.position}
                  <span className="text-ink/40 font-normal"> / {f.total}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">My registrations</h2>
        {myRegistrations.length === 0 && (
          <p className="text-ink/60 text-sm">No registrations yet — see events below.</p>
        )}
        {myRegistrations.map((r) => (
          <div key={r.registrationId} className="bg-white border border-ink/10 rounded-xl px-4 py-3">
            <p className="font-semibold">{r.eventName}</p>
            <p className="text-ink/60 text-sm">
              {r.divisionName}
              {r.teamName ? ` · ${r.teamName}` : ""} · {r.eventStartDate}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs capitalize text-ink/50">{r.paymentStatus}</span>
              <Link href={`/leaderboard/${r.divisionId}`} className="text-accent text-xs hover:underline">
                View leaderboard →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">Register for an event</h2>
        {registerableEvents.length === 0 && (
          <p className="text-ink/60 text-sm">No new events open for registration right now.</p>
        )}
        {registerableEvents.map((e) => (
          <a
            key={e.id}
            href={`/register/${e.id}`}
            className="block bg-white border border-ink/10 rounded-xl px-4 py-3 hover-lift"
          >
            <p className="font-semibold">{e.name}</p>
            <p className="text-ink/60 text-sm">
              {e.start_date}
              {e.end_date ? ` – ${e.end_date}` : ""}
              {e.venue_name ? ` · ${e.venue_name}` : ""}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
