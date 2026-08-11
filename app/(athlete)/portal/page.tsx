import { createClient } from "@/lib/supabase/server";
import { computeStandings, type LeaderboardRow, type ScoringConfig } from "@/lib/leaderboard";
import { computeSeriesStandingsForEvents } from "@/lib/seriesStandings";
import Link from "next/link";
import AvatarUpload from "./AvatarUpload";
import EditProfile from "./EditProfile";

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, phone, gym_name")
    .eq("id", user.id)
    .single();

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

  // Best finishes — for every division the athlete has actually scored in,
  // compute that division's real standings (using its own scoring formula)
  // and pull out this athlete's own placement. One leaderboard read per
  // division, fired in parallel rather than sequentially. Divisions with no
  // scores yet (or where the athlete isn't ranked) are skipped.
  const liveBestFinishes = (
    await Promise.all(
      myRegistrations.map(async (reg) => {
        const { data: rows } = await supabase
          .from("public_leaderboard")
          .select(
            "heat_assignment_id, workout_id, value_raw, registration_id, display_name, tiebreak_value, workout_scoring_config"
          )
          .eq("division_id", reg.divisionId);
        if (!rows || rows.length === 0) return null;
        const { standings } = computeStandings(rows as LeaderboardRow[], reg.scoringConfig);
        const mine = standings.find((s) => s.registrationId === reg.registrationId);
        if (!mine) return null;
        return {
          eventName: reg.eventName,
          divisionName: reg.divisionName,
          position: mine.place,
          total: standings.length,
        };
      })
    )
  ).filter((f): f is { eventName: string; divisionName: string; position: number; total: number } => f !== null);

  // Placements from events run outside Wodflow (Indy/Remix, etc. — see
  // migration-051). RLS only ever returns THIS athlete's own rows
  // (matched by their logged-in email), so no extra filtering needed
  // here.
  const { data: historicalRows } = await supabase
    .from("historical_results")
    .select("event_name, division_name, position, entrants");
  const historicalBestFinishes = (historicalRows ?? []).map((h) => ({
    eventName: h.event_name,
    divisionName: h.division_name,
    position: h.position,
    total: h.entrants,
  }));

  const bestFinishes = [...liveBestFinishes, ...historicalBestFinishes].sort((a, b) => a.position - b.position);

  const registeredEventIds = new Set(myRegistrations.map((r) => r.eventId));
  const registerableEvents = (upcomingEvents ?? []).filter((e) => !registeredEventIds.has(e.id));

  // Season/BIG leaderboard rank — the current season is just "whichever
  // series has the latest year", since there's no explicit "active"
  // flag yet (one series per season is the only setup this app has).
  const { data: currentSeries } = await supabase
    .from("series")
    .select("points_config, series_events(event_id)")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  let seasonRank: { position: number; total: number } | null = null;
  if (currentSeries) {
    const seriesEventIds = (currentSeries.series_events ?? []).map((se) => se.event_id);
    const pointsConfig = (currentSeries.points_config ?? { method: "gap_formula", winner_points: 100 }) as ScoringConfig;
    const seriesStandings = await computeSeriesStandingsForEvents(supabase, seriesEventIds, pointsConfig);
    const idx = seriesStandings.findIndex((s) => s.profileId === user.id);
    // Male and Female are separate competitions on the admin Season
    // Leaderboard (they're never ranked against each other), so an
    // athlete's own rank must be computed within their own gender group
    // too — ranking against the combined field showed a rank ~2x too
    // high (e.g. 81 of 154 instead of 45 of 77). Found 2026-08-03.
    if (idx !== -1) {
      const myGender = seriesStandings[idx].gender;
      const genderGroup = seriesStandings.filter((s) => s.gender === myGender);
      const idxInGroup = genderGroup.findIndex((s) => s.profileId === user.id);
      seasonRank = { position: idxInGroup + 1, total: genderGroup.length };
    }
  }

  const eventsEntered = new Set(myRegistrations.map((r) => r.eventId)).size;
  const bestOverall = bestFinishes[0] ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="py-2 flex flex-col items-center gap-3">
        <AvatarUpload
          profileId={user.id}
          initialAvatarUrl={myProfile?.avatar_url ?? null}
          fullName={myProfile?.full_name ?? "Athlete"}
        />
        <h1 className="text-2xl font-semibold">My Wodflow</h1>
        <EditProfile
          profileId={user.id}
          initialFullName={myProfile?.full_name ?? ""}
          initialPhone={myProfile?.phone ?? ""}
          initialEmail={user.email ?? ""}
          initialGymName={myProfile?.gym_name ?? ""}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBubble label="Upcoming events" value={String(eventsEntered)} />
        <StatBubble
          label="Best finish"
          value={bestOverall ? String(bestOverall.position) : "—"}
          sub={bestOverall ? `of ${bestOverall.total}` : undefined}
        />
        <StatBubble
          label="Season rank"
          value={seasonRank ? String(seasonRank.position) : "—"}
          sub={seasonRank ? `of ${seasonRank.total}` : undefined}
        />
      </div>

      {bestFinishes.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-paper/50">Best Finishes</h2>
          <div className="bg-white text-ink border-2 border-ink rounded-xl divide-y divide-ink/5">
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
        <h2 className="font-semibold text-sm uppercase tracking-wider text-paper/50">My registrations</h2>
        {myRegistrations.length === 0 && (
          <p className="text-paper/60 text-sm">No registrations yet — see events below.</p>
        )}
        {myRegistrations.map((r) => (
          <div key={r.registrationId} className="bg-white text-ink border-2 border-ink rounded-xl px-4 py-3">
            <p className="font-semibold">{r.eventName}</p>
            <p className="text-ink/60 text-sm">
              {r.divisionName}
              {r.teamName ? ` · ${r.teamName}` : ""} · {r.eventStartDate}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs capitalize text-ink/50">{r.paymentStatus}</span>
              <Link href={`/heats/${r.divisionId}`} className="text-accent text-xs hover:underline">
                My heat →
              </Link>
              <Link href={`/leaderboard/${r.divisionId}`} className="text-accent text-xs hover:underline">
                View leaderboard →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-paper/50">Register for an event</h2>
        {registerableEvents.length === 0 && (
          <p className="text-paper/60 text-sm">No new events open for registration right now.</p>
        )}
        {registerableEvents.map((e) => (
          <a
            key={e.id}
            href={`/events/${e.id}`}
            className="block bg-white text-ink border-2 border-ink rounded-xl px-4 py-3 hover-lift"
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

function StatBubble({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white text-ink border-2 border-ink rounded-2xl px-2 py-4 text-center">
      <p className="font-data font-bold text-2xl text-accent">{value}</p>
      {sub && <p className="text-ink/40 text-xs">{sub}</p>}
      <p className="text-ink/60 text-[11px] font-semibold uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
