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

        <div className="flex flex-wrap justify-center gap-10 sm:gap-14 max-w-6xl mx-auto">
          {(events ?? []).map((e) => (
            <Link
              key={e.id}
              href={`/past-rumbles/${e.id}`}
              className="rumble-card hover-lift flex flex-col items-center gap-3 p-3 w-64 sm:w-80"
            >
              {logoUrl(e.logo_path) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl(e.logo_path)!} alt={e.name} className="w-full aspect-square object-contain" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center rumble-headline text-lg">
                  {e.name}
                </div>
              )}
              <span className="text-sm sm:text-base font-semibold">{e.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
