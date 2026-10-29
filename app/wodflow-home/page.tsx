import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getRumbleHubData } from "@/lib/rumbleHub";

// Rendered for wodflow.co.za/ only: middleware.ts rewrites "/" here on that
// host, so rumbleinrandburg.co.za keeps serving app/page.tsx untouched.
export const metadata: Metadata = {
  title: "Wodflow | Competition platform for CrossFit events",
  description:
    "The platform behind the Rumble Series: registration, live heats, offline-safe judge scoring, leaderboards and season standings for CrossFit competitions.",
};

export const revalidate = 60;

const RUMBLE_URL = "https://rumbleinrandburg.co.za";

const features = [
  {
    title: "Live heats and leaderboards",
    body: "Heat sheets and leaderboards update as scores land. Athletes and spectators follow on their phones, no refresh needed.",
  },
  {
    title: "Judging that survives bad signal",
    body: "A judge's phone can lose connection mid-WOD. Every score saves on the device and syncs the moment signal returns.",
  },
  {
    title: "Season standings",
    body: "Points carry across every event in a series, with configurable formulas, tie-breaks and gym-vs-gym leaderboards.",
  },
  {
    title: "Registration, waivers and tickets",
    body: "Team sign-up, PayFast payments, digital waivers and QR-code spectator tickets with gate check-in.",
  },
  {
    title: "An athlete portal",
    body: "Persistent athlete accounts with registration history and best finishes across every comp they've done.",
  },
  {
    title: "Your brand, your domain",
    body: "Each gym gets its own branded site on its own address. Wodflow runs quietly underneath.",
  },
];

function formatDate(start: string, end: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const s = new Date(`${start}T00:00:00`);
  if (!end || end === start) return `${s.toLocaleDateString("en-ZA", opts)} ${s.getFullYear()}`;
  const e = new Date(`${end}T00:00:00`);
  return `${s.toLocaleDateString("en-ZA", opts)} – ${e.toLocaleDateString("en-ZA", opts)} ${e.getFullYear()}`;
}

export default async function WodflowHomePage() {
  const { event: hubEvent } = await getRumbleHubData();
  // The hub keeps returning an event until its status is changed, so hide a finished one here.
  const today = new Date().toISOString().slice(0, 10);
  const event = hubEvent && (hubEvent.end_date ?? hubEvent.start_date) >= today ? hubEvent : null;

  return (
    <main className="graffiti-page min-h-screen px-4 pt-16 pb-8">
      <div className="mx-auto max-w-4xl">
        {/* ---------- Hero ---------- */}
        <section className="text-center">
          <h1 className="text-5xl sm:text-7xl">
            <Logo />
          </h1>
          <p className="mt-4 text-xl sm:text-2xl uppercase tracking-wide">Run your competition like the Rumble</p>
          <p className="mt-4 mx-auto max-w-xl text-paper/80">
            Wodflow is the platform that runs the Rumble Series, from sign-up to the final leaderboard. Built with the
            organisers who run it, tested on real event days.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="https://drafttwo.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent text-white font-semibold uppercase tracking-wider rounded-full px-7 py-3 hover-lift"
            >
              Host your next comp →
            </a>
            <a
              href={RUMBLE_URL}
              className="border-2 border-paper/70 text-paper font-semibold uppercase tracking-wider rounded-full px-7 py-3 hover-lift"
            >
              See it live: Rumble →
            </a>
          </div>
        </section>

        {/* ---------- Flagship ---------- */}
        <section className="mt-20">
          <h2 className="sticker text-sm">Flagship</h2>
          <a
            href={RUMBLE_URL}
            className="mt-4 block rounded-2xl border-2 border-paper/20 overflow-hidden hover-lift bg-black/40"
          >
            <div className="grid grid-cols-4">
              {[1, 3, 5, 7].map((n) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={n}
                  src={`/rumble/photos/photo-${n}.jpg`}
                  alt=""
                  loading="lazy"
                  className="h-28 sm:h-44 w-full object-cover"
                />
              ))}
            </div>
            <div className="p-6">
              <h3 className="text-3xl">Rumble Series</h3>
              <p className="mt-1 text-paper/70">Against The Grain Fitness · Randburg</p>
              {event && (
                <p className="mt-3 text-paper/90">
                  Next: {event.name}, {formatDate(event.start_date, event.end_date)}
                  {event.venue_name ? ` · ${event.venue_name}` : ""}
                </p>
              )}
              <p className="mt-4 text-accent font-semibold uppercase tracking-wider">Visit rumbleinrandburg.co.za →</p>
            </div>
          </a>
        </section>

        {/* ---------- Why Wodflow ---------- */}
        <section className="mt-20">
          <h2 className="sticker text-sm">Why Wodflow</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-paper/15 bg-black/40 p-5">
                <h3 className="text-xl">{f.title}</h3>
                <p className="mt-2 text-sm text-paper/75">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="mt-20 text-center">
          <h2 className="text-3xl">Host your next comp through us</h2>
          <p className="mt-3 text-paper/75">We set up your event, your branding and your domain. You run the day.</p>
          <a
            href="https://drafttwo.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block bg-accent text-white font-semibold uppercase tracking-wider rounded-full px-7 py-3 hover-lift"
          >
            Get in touch →
          </a>
          <p className="mt-8 text-sm text-paper/60">
            Already registered? <Link href="/login" className="underline">Organiser sign-in</Link> ·{" "}
            <Link href="/athlete-login" className="underline">Athlete sign-in</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
