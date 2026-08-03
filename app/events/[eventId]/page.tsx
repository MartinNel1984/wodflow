import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { createPublicClient } from "@/lib/supabase/public";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { BackLink } from "@/components/BackLink";
import { RumbleBackdrop } from "@/components/RumbleBackdrop";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const supabase = createPublicClient();
  const { data: event } = await supabase.from("events").select("name").eq("id", eventId).single();
  if (!event?.name) return {};

  return {
    title: event.name,
    description: `${event.name} on Wodflow — event details, venue, waiver, and registration.`,
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = createPublicClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, start_date, end_date, venue_name, venue_address, contact_email, contact_phone, description, waiver_text, poster_url, brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline)"
    )
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const brandKit = (Array.isArray(event.brand_kits) ? event.brand_kits[0] : event.brand_kits) as
    | BrandKit
    | null
    | undefined;

  const isBigOne = brandKit?.name === "Rumble Big One";

  const content = (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-8" style={brandKitStyle(brandKit)}>
      {event.poster_url && !isBigOne && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.poster_url}
          alt={event.name}
          className="w-full aspect-video object-cover rounded-xl animate-settle-in"
        />
      )}

      <div className="text-center">
        {!event.poster_url && brandKit?.logo_url && (
          <BrandKitLogo kit={brandKit} className="h-12 mx-auto mb-3" />
        )}
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-ink/60 text-sm mt-1 font-data">
          {event.start_date}
          {event.end_date ? ` – ${event.end_date}` : ""}
        </p>
        {brandKit?.tagline && <span className="sticker text-xs mt-2 inline-block">{brandKit.tagline}</span>}
      </div>

      {(event.venue_name || event.venue_address || event.contact_email || event.contact_phone) && (
        <div className="bg-white border border-ink/10 rounded-xl p-4 text-sm space-y-1">
          <h2 className="font-semibold text-xs uppercase tracking-wider text-ink/50 mb-2">Venue &amp; contact</h2>
          {event.venue_name && <p className="font-semibold">{event.venue_name}</p>}
          {event.venue_address && <p className="text-ink/70">{event.venue_address}</p>}
          {event.contact_email && (
            <p className="text-ink/70">
              <a href={`mailto:${event.contact_email}`} className="hover:underline">
                {event.contact_email}
              </a>
            </p>
          )}
          {event.contact_phone && (
            <p className="text-ink/70">
              <a href={`tel:${event.contact_phone}`} className="hover:underline">
                {event.contact_phone}
              </a>
            </p>
          )}
        </div>
      )}

      {event.description && (
        <div className="space-y-2">
          <h2 className="font-semibold text-xs uppercase tracking-wider text-ink/50">About this event</h2>
          <div className="event-markdown text-sm text-ink/80">
            <ReactMarkdown>{event.description}</ReactMarkdown>
          </div>
        </div>
      )}

      {event.waiver_text && (
        <div className="space-y-2">
          <details className="bg-white border border-ink/10 rounded-xl group">
            <summary className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink/50 cursor-pointer list-none flex items-center justify-between">
              Waiver
              <span className="text-accent text-base leading-none normal-case group-open:hidden">+</span>
              <span className="text-accent text-base leading-none normal-case hidden group-open:inline">−</span>
            </summary>
            <div className="border-t border-ink/10 p-4 text-sm text-ink/80 whitespace-pre-wrap">
              {event.waiver_text}
            </div>
          </details>
          <p className="text-ink/40 text-xs">You&apos;ll be asked to accept this waiver when you register.</p>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <a
          href={`/register/${eventId}`}
          className="w-full text-center bg-accent text-white rounded-lg py-3 text-sm font-semibold hover-lift"
        >
          Register →
        </a>
      </div>
    </div>
  );

  if (isBigOne) {
    return (
      <RumbleBackdrop logoSrc={brandKit?.logo_url || "/rumble/series-logo-v2.png"} logoAlt={brandKit?.name || "Rumble Big One"} backHref="/all-events">
        <div className="w-full max-w-xl bg-white text-ink rounded-2xl shadow-xl">{content}</div>
      </RumbleBackdrop>
    );
  }

  return (
    <>
      <BackLink href="/all-events" />
      {content}
    </>
  );
}
