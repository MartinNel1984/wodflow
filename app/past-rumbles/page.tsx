import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";

export const metadata: Metadata = {
  title: "Past Rumbles | Rumble Series",
  description: "Every past Rumble Series event and its final results.",
};

export const revalidate = 60;

export default async function PastRumblesPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("historical_events")
    .select("id, name, logo_path, event_date")
    .order("sort_order", { ascending: true });

  const logoUrl = (path: string | null) =>
    path ? supabase.storage.from("historical-event-logos").getPublicUrl(path).data.publicUrl : null;

  return (
    <main className="rumble-page min-h-screen">
      <div className="rumble-texture" aria-hidden="true" />
      <BackLink href="/" />

      <section className="rumble-section text-center">
        <h1 className="rumble-section-title">Past Rumbles</h1>
        <p className="text-sm opacity-70 mb-8">Every Rumble Series event so far — tap a logo for the full results.</p>

        {(events ?? []).length === 0 && <p className="opacity-70">No past events added yet — check back soon.</p>}

        {groupByYear(events ?? []).map(([year, yearEvents]) => (
          <div key={year} className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider opacity-50 mb-4">{year}</h2>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 max-w-6xl mx-auto">
              {yearEvents.map((e) => (
                <Link
                  key={e.id}
                  href={`/past-rumbles/${e.id}`}
                  className="rumble-card hover-lift flex flex-col items-center gap-3 p-3 w-32 sm:w-44"
                >
                  {logoUrl(e.logo_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl(e.logo_path)!}
                      alt={e.name}
                      className={`aspect-square object-contain ${e.name === "Indy 2026" ? "w-[70%]" : "w-full"}`}
                    />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center rumble-headline text-lg">
                      {e.name}
                    </div>
                  )}
                  <span className="text-sm sm:text-base font-semibold">{e.name}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

// Groups into one row per year (2026's Indy/Remix/The Big One
// together, 2025's three together, etc) — order preserved within each
// year from the query's own sort_order, years themselves shown
// newest-first. Falls back to "Other" for a name with no 4-digit year
// (shouldn't happen given current naming, but keeps the page from
// silently dropping a row rather than crashing on a future rename).
function groupByYear<T extends { name: string }>(events: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const e of events) {
    const year = e.name.match(/\b(20\d{2})\b/)?.[1] ?? "Other";
    const group = groups.get(year) ?? [];
    group.push(e);
    groups.set(year, group);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}
