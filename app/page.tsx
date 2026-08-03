import type { Metadata } from "next";
import Link from "next/link";
import { getRumbleHubData } from "@/lib/rumbleHub";
import { Logo } from "@/components/Logo";
import { PhotoCarousel } from "@/components/PhotoCarousel";

export const metadata: Metadata = {
  title: "Rumble Series | Against The Grain Fitness",
  description: "Yeeeah! Get Some! The Big One, Oct 2-4 2026 — leaderboard, heats, news and more from the Rumble Series.",
};

// Otherwise Next prerenders this once at build time and never again —
// new hub photos, milestone changes, and the live/teaser leaderboard
// switch on event day would all need a redeploy to show up.
export const revalidate = 60;

function formatDateRange(start: string, end: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startDate = new Date(`${start}T00:00:00`);
  const startStr = startDate.toLocaleDateString("en-ZA", opts).toUpperCase();
  if (!end || end === start) {
    return `${startStr}, ${startDate.getFullYear()}`;
  }
  const endDate = new Date(`${end}T00:00:00`);
  const endStr = endDate.toLocaleDateString("en-ZA", opts).toUpperCase();
  return `${startStr} – ${endStr}, ${endDate.getFullYear()}`;
}

export default async function RumbleHubPage() {
  const { event, divisions, isLive, milestones, photos } = await getRumbleHubData();

  return (
    <main className="rumble-page">
      <div className="rumble-photos" aria-hidden="true">
        {/* eslint-disable @next/next/no-img-element */}
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <img key={n} src={`/rumble/photos/photo-${n}.jpg`} alt="" />
        ))}
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      <div className="rumble-texture" aria-hidden="true" />

      {/* ---------- Hero ---------- */}
      <section className="rumble-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rumble/series-logo-v2.png" alt="Rumble Series" className="rumble-hero-logo" />
        <p className="rumble-tagline">Yeeeah! Get Some!</p>
        {event && (
          <p className="rumble-dates">
            {event.name} · {formatDateRange(event.start_date, event.end_date)}
            {event.venue_name ? ` · ${event.venue_name}` : ""}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6">
          <Link href="/all-events" className="rumble-cta-fork rumble-cta-fork--blue hover-lift">
            I&apos;m Competing →
          </Link>
          <Link href="/tickets" className="rumble-cta-fork rumble-cta-fork--volt hover-lift">
            I&apos;m Spectating →
          </Link>
          {event && (
            <Link
              href={`/events/${event.id}/judge-signup`}
              className="rumble-cta-fork rumble-cta-fork--magenta hover-lift"
            >
              I&apos;m Judging →
            </Link>
          )}
        </div>
        <div className="flex justify-center gap-4 mt-4 text-xs opacity-70">
          <a href="/login" className="underline">
            Organizer sign-in
          </a>
        </div>
      </section>

      {/* ---------- Leaderboard / Heats ---------- */}
      <section className="rumble-section">
        <h2 className="rumble-section-title">Leaderboard &amp; Heats</h2>
        {isLive && event && divisions.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {divisions.map((d) => (
              <div key={d.id} className="rumble-card flex items-center justify-between gap-3">
                <span className="font-semibold">{d.name}</span>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={`/leaderboard/${d.id}`}
                    className="rumble-display text-sm px-3 py-1.5 rounded-full"
                    style={{ background: "var(--rumble-blue-bright)", color: "#0a0b10" }}
                  >
                    Leaderboard
                  </a>
                  <a
                    href={`/heats/${d.id}`}
                    className="rumble-display text-sm px-3 py-1.5 rounded-full border"
                    style={{ borderColor: "var(--rumble-blue-bright)", color: "var(--rumble-blue-bright)" }}
                  >
                    Heats
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rumble-card text-center">
            <p className="rumble-headline text-xl" style={{ color: "var(--rumble-blue-bright)" }}>
              {event ? `Leaderboard opens ${formatDateRange(event.start_date, null)}` : "Leaderboard opens soon"}
            </p>
            <p className="text-sm mt-2 opacity-70">Check back once The Big One kicks off.</p>
          </div>
        )}
      </section>

      {/* ---------- News ---------- */}
      <section className="rumble-section">
        <h2 className="rumble-section-title">News</h2>
        <ul className="space-y-2">
          {milestones.registrationOpen && (
            <li className="rumble-card">Registration is open — grab your team&apos;s spot.</li>
          )}
          {milestones.heatsReleased && <li className="rumble-card">Heats have been released.</li>}
          {milestones.resultsLive && <li className="rumble-card">Results are live on the leaderboard.</li>}
          {!milestones.registrationOpen && (
            <li className="rumble-card opacity-70">No news yet — check back closer to the event.</li>
          )}
        </ul>
      </section>

      {/* ---------- Photo carousel ---------- */}
      {photos.length > 0 && (
        <section className="rumble-section">
          <h2 className="rumble-section-title">From the Floor</h2>
          <PhotoCarousel photos={photos} />
        </section>
      )}

      {/* ---------- Social ---------- */}
      <section className="rumble-section text-center">
        <h2 className="rumble-section-title">Follow the Rumble</h2>
        <div className="flex justify-center gap-3">
          <a
            href="https://www.instagram.com/rumble_inrandburg/"
            target="_blank"
            rel="noopener noreferrer"
            className="rumble-card px-5 py-2.5 text-sm font-semibold"
          >
            Instagram
          </a>
          <a
            href="https://www.facebook.com/randburgrumble"
            target="_blank"
            rel="noopener noreferrer"
            className="rumble-card px-5 py-2.5 text-sm font-semibold"
          >
            Facebook
          </a>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="rumble-section text-center text-xs opacity-50 pb-10 space-y-3">
        <div className="text-base font-semibold opacity-70"><Logo /></div>
        <p className="mt-1 opacity-70">Infrastructure managed by Wodflow</p>
      </footer>
    </main>
  );
}
