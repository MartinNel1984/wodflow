import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { BackLink } from "@/components/BackLink";
import { brandKitStyle } from "@/lib/brandKit";

export const metadata: Metadata = {
  title: "Buy Tickets | Wodflow",
  description: "Come watch the action — spectator passes for upcoming events on Wodflow.",
};

export default async function TicketsListPage() {
  const supabase = await createClient();
  const { data: allEvents } = await supabase
    .from("events")
    .select(
      "id, name, start_date, end_date, venue_name, poster_url, spectator_price, weekend_pass_price, brand_kits(name, logo_url, color_primary, tagline)"
    )
    .in("status", ["published", "live"])
    .order("start_date", { ascending: true });

  // At least one ticket type must be priced (opt-in per event) — can't
  // express "A or B is not null" as a single .or() filter cleanly
  // alongside .in(), so filter in JS instead.
  const events = (allEvents ?? []).filter((e) => e.spectator_price != null || e.weekend_pass_price != null);

  const hasEvents = events.length > 0;

  // Show the cheaper of the two prices when both are set ("from R__"
  // matches how the event's own tickets page lets buyers pick either).
  function fromPrice(e: (typeof events)[number]) {
    const prices = [e.spectator_price, e.weekend_pass_price].filter((p): p is number => p != null);
    return Math.min(...prices);
  }

  return (
    <main className="graffiti-page min-h-screen flex flex-col items-center px-4 py-12">
      <BackLink href="/" />
      <div className="rumble-photos" aria-hidden="true">
        {/* eslint-disable @next/next/no-img-element */}
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <img key={n} src={`/rumble/photos/photo-${n}.jpg`} alt="" />
        ))}
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      <div className="rumble-texture" aria-hidden="true" />

      <div className="w-full max-w-sm space-y-3 mb-10 mt-6">
        <h2 className="sticker text-sm">Buy tickets</h2>
        <p className="text-paper/70 text-sm">Come watch the action — spectator passes for upcoming events.</p>

        {!hasEvents && (
          <div className="bg-white text-ink border-2 border-ink rounded-xl px-4 py-6 text-center mt-4">
            <p className="font-semibold">No tickets on sale right now — check back soon.</p>
            <Link href="/" className="mt-3 inline-block text-accent text-sm font-semibold hover:underline">
              ← Back to home
            </Link>
          </div>
        )}

        {events.map((e) => {
          const kit = Array.isArray(e.brand_kits) ? e.brand_kits[0] : e.brand_kits;

          if (!e.poster_url) {
            return (
              <a
                key={e.id}
                href={`/events/${e.id}/tickets`}
                style={brandKitStyle(kit)}
                className="flex items-center gap-3 bg-white text-ink border-2 border-ink rounded-xl px-4 py-3 hover-lift"
              >
                {kit?.logo_url && <BrandKitLogo kit={kit} className="h-8 shrink-0" />}
                <div className="flex-1">
                  <p className="font-semibold">{e.name}</p>
                  <p className="text-ink/60 text-sm">
                    {e.start_date}
                    {e.end_date ? ` – ${e.end_date}` : ""}
                    {e.venue_name ? ` · ${e.venue_name}` : ""}
                  </p>
                  {kit?.tagline && <span className="tagline-script mt-1">{kit.tagline}</span>}
                </div>
                <span className="shrink-0 bg-accent text-white text-xs font-semibold uppercase tracking-wider rounded-full px-3 py-1.5">
                  From R{fromPrice(e)} →
                </span>
              </a>
            );
          }

          return (
            <a
              key={e.id}
              href={`/events/${e.id}/tickets`}
              style={brandKitStyle(kit)}
              className="block bg-white text-ink border-2 border-ink rounded-xl overflow-hidden hover-lift animate-settle-in"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.poster_url} alt={e.name} className="w-full aspect-video object-cover" />
              <div className="px-4 py-3">
                <p className="font-semibold">{e.name}</p>
                <p className="text-ink/60 text-sm font-data">
                  {e.start_date}
                  {e.end_date ? ` – ${e.end_date}` : ""}
                  {e.venue_name ? ` · ${e.venue_name}` : ""}
                </p>
                {kit?.tagline && <span className="tagline-script mt-1">{kit.tagline}</span>}
                <span className="mt-3 inline-block bg-accent text-white text-xs font-semibold uppercase tracking-wider rounded-full px-3 py-1.5">
                  From R{fromPrice(e)} — Buy tickets →
                </span>
              </div>
            </a>
          );
        })}
      </div>

      <div className="text-center mt-auto pt-10">
        <div className="text-base font-semibold opacity-60"><Logo /></div>
        <p className="mt-1 text-paper/40 text-xs">Infrastructure managed by Wodflow</p>
      </div>
    </main>
  );
}
