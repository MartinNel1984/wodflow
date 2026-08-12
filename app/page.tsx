import type { Metadata } from "next";
import Link from "next/link";
import { getRumbleHubData } from "@/lib/rumbleHub";
import { PhotoCarousel } from "@/components/PhotoCarousel";

export const metadata: Metadata = {
  title: "Rumble Series | Against The Grain Fitness",
  description: "Yeeeah! Get Some! The Big One, Oct 2-4 2026 — leaderboard, heats, news and more from the Rumble Series.",
};

// Otherwise Next prerenders this once at build time and never again —
// new hub photos, milestone changes, and the live/teaser leaderboard
// switch on event day would all need a redeploy to show up.
export const revalidate = 60;

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

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
      <div className="rumble-texture" aria-hidden="true" />

      {/* ---------- Hero ---------- */}
      <section className="rumble-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rumble/series-logo-v2.png" alt="Rumble Series" className="rumble-hero-logo" />
        <p className="rumble-tagline">Yeeeah! Get Some!</p>
        {event && (
          <p className="rumble-dates">
            Next event: Rumble &ldquo;The Big One&rdquo;
            <br />
            {formatDateRange(event.start_date, event.end_date)}
            {event.venue_name ? ` · ${event.venue_name}` : ""}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6">
          <Link href="/all-events" className="rumble-cta-fork rumble-cta-fork--dark-blue hover-lift">
            I&apos;m Competing →
          </Link>
          <Link href="/tickets" className="rumble-cta-fork rumble-cta-fork--blue hover-lift">
            I&apos;m Spectating →
          </Link>
          {event && (
            <Link
              href={`/events/${event.id}/judge-signup`}
              className="rumble-cta-fork rumble-cta-fork--white hover-lift"
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

      {/* ---------- Past Rumbles ---------- */}
      <section className="rumble-section text-center">
        <h2 className="rumble-section-title">Past Rumbles</h2>
        <p className="text-sm opacity-70 mb-4">Results from every Rumble Series event so far.</p>
        <Link href="/past-rumbles" className="rumble-cta-fork rumble-cta-fork--blue hover-lift">
          See Past Results →
        </Link>
      </section>

      {/* ---------- Social ---------- */}
      <section className="rumble-section text-center">
        <h2 className="rumble-section-title">Follow the Rumble</h2>
        <div className="flex justify-center gap-4">
          <a
            href="https://www.instagram.com/rumble_inrandburg/"
            target="_blank"
            rel="noopener noreferrer"
            className="social-pill social-pill--instagram"
          >
            <span className="social-pill-badge social-pill-badge--instagram">
              <InstagramIcon />
            </span>
            Instagram
          </a>
          <a
            href="https://www.facebook.com/randburgrumble"
            target="_blank"
            rel="noopener noreferrer"
            className="social-pill social-pill--facebook"
          >
            <span className="social-pill-badge social-pill-badge--facebook">
              <FacebookIcon />
            </span>
            Facebook
          </a>
        </div>
      </section>
    </main>
  );
}
