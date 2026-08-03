import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { BackLink } from "@/components/BackLink";
import { brandKitStyle } from "@/lib/brandKit";

export const metadata: Metadata = {
  title: "Events | Wodflow",
  description: "Upcoming CrossFit competitions on Wodflow — register, sign in, and follow the action.",
};

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select(
      "id, name, start_date, end_date, venue_name, description, poster_url, brand_kits(name, logo_url, color_primary, tagline)"
    )
    .in("status", ["published", "live"])
    .order("start_date", { ascending: true });

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

      <div
        className="w-full max-w-sm space-y-3 mb-10 mt-6"
        style={brandKitStyle(Array.isArray(events?.[0]?.brand_kits) ? events?.[0]?.brand_kits[0] : events?.[0]?.brand_kits)}
      >
        <h2 className="sticker text-sm">Upcoming events</h2>
        {(events ?? []).length === 0 && (
          <p className="text-paper/70 text-sm">No events open for registration right now.</p>
        )}
        {(events ?? []).map((e) => {
          const kit = Array.isArray(e.brand_kits) ? e.brand_kits[0] : e.brand_kits;

          if (!e.poster_url) {
            return (
              <a
                key={e.id}
                href={`/events/${e.id}`}
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
                <span className="shrink-0 bg-accent text-white text-sm font-semibold uppercase tracking-wider rounded-full px-5 py-2.5">
                  Enter now →
                </span>
              </a>
            );
          }

          return (
            <a
              key={e.id}
              href={`/events/${e.id}`}
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
                {e.description && <p className="text-ink/70 text-sm mt-2 line-clamp-3">{e.description}</p>}
                <span className="mt-4 block text-center bg-accent text-white text-base font-semibold uppercase tracking-wider rounded-full px-6 py-3.5">
                  Enter now →
                </span>
              </div>
            </a>
          );
        })}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-2">
        <a
          href="/athlete-login"
          className="bg-skyblue text-ink rounded-lg py-3 text-sm font-semibold hover-lift text-center border-2 border-paper"
        >
          Athlete sign-in
        </a>
        <a
          href="/judge-login"
          className="bg-cobalt text-white rounded-lg py-3 text-sm font-semibold hover-lift text-center border-2 border-paper"
        >
          Judge sign-in
        </a>
        <a
          href="/login"
          className="bg-white text-ink border-2 border-paper rounded-lg py-3 text-sm font-semibold hover-lift text-center"
        >
          Organizer sign-in
        </a>
      </div>

      <div className="text-center mt-auto pt-10">
        <div className="text-base font-semibold opacity-60"><Logo /></div>
        <p className="mt-1 text-paper/40 text-xs">Infrastructure managed by Wodflow</p>
      </div>
    </main>
  );
}
