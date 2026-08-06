import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { BackLink } from "@/components/BackLink";
import { computeHistoricalEventPoints, type HistoricalEventResultRow } from "@/lib/historicalEventResults";
import type { ScoringConfig } from "@/lib/leaderboard";

export const revalidate = 60;

export default async function PastRumbleResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: series }] = await Promise.all([
    supabase.from("historical_events").select("id, name, logo_path, event_date").eq("id", id).single(),
    supabase.from("series").select("points_config").limit(1).maybeSingle(),
  ]);

  if (!event) {
    return <p className="text-center py-20 opacity-70">Event not found.</p>;
  }

  const { data: rows } = await supabase
    .from("public_historical_event_results")
    .select("division_name, team_name, athlete_name, position, entrants, gender, season_tier")
    .eq("historical_event_id", id);

  const pointsConfig = (series?.points_config ?? { method: "gap_formula", winner_points: 100 }) as ScoringConfig;
  const placements = computeHistoricalEventPoints((rows ?? []) as HistoricalEventResultRow[], pointsConfig);

  const logoUrl = event.logo_path
    ? supabase.storage.from("historical-event-logos").getPublicUrl(event.logo_path).data.publicUrl
    : null;

  const male = placements.filter((p) => p.gender === "male").sort((a, b) => a.position - b.position || 0);
  const female = placements.filter((p) => p.gender === "female").sort((a, b) => a.position - b.position || 0);
  const other = placements.filter((p) => p.gender !== "male" && p.gender !== "female");

  return (
    <main className="rumble-page min-h-screen">
      <div className="rumble-texture" aria-hidden="true" />
      <BackLink href="/past-rumbles" />

      <section className="rumble-section text-center">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={event.name} className="w-60 sm:w-72 mx-auto mb-4" />
        )}
        <h1 className="rumble-section-title">{event.name}</h1>
        {event.event_date && <p className="text-sm opacity-70 mb-8">{event.event_date}</p>}
      </section>

      <ResultsTable title="Male" placements={sortByDivisionThenPosition(male)} />
      <ResultsTable title="Female" placements={sortByDivisionThenPosition(female)} />
      {other.length > 0 && <ResultsTable title="Results" placements={sortByDivisionThenPosition(other)} />}

      <footer className="rumble-section text-center text-xs opacity-50 pb-10 space-y-3">
        <div className="text-base font-semibold opacity-70"><Logo /></div>
        <p className="mt-1 opacity-70">
          <a href="https://drafttwo.co.za" className="no-underline text-inherit">
            Infrastructure managed by Wodflow
          </a>
        </p>
      </footer>
    </main>
  );
}

// Groups by division name for display regardless of whether
// season_tier is set — some events (e.g. Remix 2026's mixed-gender
// team divisions) deliberately leave season_tier unset so their
// points aren't cross-tier combined, but still want RX and Not So
// RX'd shown as separate blocks rather than interleaved by raw
// position. When season_tier IS set it already puts RX (tier 1)
// ahead of Not So RX'd (tier 2); when it's null both fall back to
// this rank, which must not be plain alphabetical — "Not So RX'd"
// sorts before "RX" alphabetically, which is backwards from how
// every tiered event already displays (found on Remix 2026, whose
// division rows have season_tier: null).
function divisionDisplayRank(divisionName: string): number {
  if (/^rx$/i.test(divisionName.trim())) return 0;
  if (/not so rx/i.test(divisionName)) return 1;
  return 2;
}

function sortByDivisionThenPosition<T extends { division_name: string; season_tier: number | null; position: number }>(
  rows: T[]
): T[] {
  return [...rows].sort(
    (a, b) =>
      (a.season_tier ?? 0) - (b.season_tier ?? 0) ||
      divisionDisplayRank(a.division_name) - divisionDisplayRank(b.division_name) ||
      a.division_name.localeCompare(b.division_name) ||
      a.position - b.position
  );
}

function ResultsTable({
  title,
  placements,
}: {
  title: string;
  placements: ReturnType<typeof computeHistoricalEventPoints>;
}) {
  if (placements.length === 0) return null;
  return (
    <section className="rumble-section">
      <h2 className="rumble-section-title">{title}</h2>
      <div className="rumble-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-60">
              <th className="px-3 py-2">Division</th>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Team / Athlete</th>
              <th className="px-3 py-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {placements.map((p, i) => (
              <tr key={`${p.athlete_name}-${i}`} className="border-t border-white/10">
                <td className="px-3 py-2 opacity-70 whitespace-nowrap">{p.division_name}</td>
                <td className="px-3 py-2 font-bold" style={{ color: "var(--rumble-blue-bright)" }}>
                  {p.position}
                </td>
                <td className="px-3 py-2">
                  {p.team_name ? `${p.team_name} — ` : ""}
                  {p.athlete_name}
                </td>
                <td className="px-3 py-2 text-right font-data">{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
