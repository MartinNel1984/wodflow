import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { brandKitStyle } from "@/lib/brandKit";

export default async function Home() {
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
      <div className="graffiti-photos" aria-hidden="true">
        {/* eslint-disable @next/next/no-img-element */}
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <img key={n} src={`/mural/action-${n}.jpg`} alt="" />
        ))}
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      <div className="graffiti-hex" aria-hidden="true" />
      <div className="text-center max-w-sm mb-10 py-6">
        <h1 className="text-3xl font-semibold"><Logo /></h1>
        <p className="text-script text-2xl mt-3 text-accent">Feel the flow. Chase the clock.</p>
        <p className="mt-2 text-paper/60 text-sm font-semibold">Competition management for CrossFit events.</p>
      </div>

      <div className="w-full max-w-sm space-y-3 mb-10">
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
                href={`/register/${e.id}`}
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
                  {kit?.tagline && <span className="sticker text-xs mt-1 inline-block">{kit.tagline}</span>}
                </div>
                <span className="shrink-0 bg-accent text-white text-xs font-semibold uppercase tracking-wider rounded-full px-3 py-1.5">
                  Enter now →
                </span>
              </a>
            );
          }

          return (
            <a
              key={e.id}
              href={`/register/${e.id}`}
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
                {kit?.tagline && <span className="sticker text-xs mt-1 inline-block">{kit.tagline}</span>}
                {e.description && <p className="text-ink/70 text-sm mt-2 line-clamp-3">{e.description}</p>}
                <span className="mt-3 inline-block bg-accent text-white text-xs font-semibold uppercase tracking-wider rounded-full px-3 py-1.5">
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
          className="bg-accent text-white rounded-lg py-3 text-sm font-semibold hover-lift text-center border-2 border-paper"
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
    </main>
  );
}
