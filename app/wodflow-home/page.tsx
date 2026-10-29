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

// Real figures from Rumble "The Big One" (Oct 2026), read from the live database.
const stats = [
  { n: "76", label: "teams registered and paid online" },
  { n: "152", label: "athletes on the floor" },
  { n: "462", label: "scores captured by judges" },
  { n: "54", label: "heats run across the weekend" },
  { n: "174", label: "spectator tickets sold online" },
  { n: "3", label: "days, no crashes" },
];

const stages = [
  {
    tag: "Before",
    title: "Sign-ups that run themselves",
    points: [
      "Team registration with divisions, early-bird pricing and PayFast payment, no EFT chasing",
      "Digital waivers signed before anyone arrives",
      "Athletes pick their gym from an approved list, so gym leaderboards stay clean",
      "A branded event page and poster on your own domain",
    ],
  },
  {
    tag: "Event day",
    title: "The floor runs on live data",
    points: [
      "Heat sheets and lane assignments generated and published in minutes",
      "Judges score on their phones. Lose signal mid-WOD and every score saves, then syncs when it's back",
      "Leaderboards update on their own as scores land, for athletes, coaches and the crowd",
      "Big-screen display mode for the venue TV",
    ],
  },
  {
    tag: "Spectators",
    title: "Ticketing with a real gate",
    points: [
      "Spectators buy online and get a QR ticket straight away",
      "Staff scan at the door from any phone: 84 people scanned in at the Big One",
      "Weekend passes and single-day tickets",
      "No cash handling at the gate, no oversold hall",
    ],
  },
  {
    tag: "After",
    title: "Results that keep people coming back",
    points: [
      "Final results and full history published the moment the last score is in",
      "Athlete accounts with every comp they've done and their best finishes",
      "Season standings across a whole series, plus a gym-vs-gym Community Cup",
      "Event photo galleries, linked to the results",
    ],
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
          <p className="mt-4 text-2xl sm:text-4xl uppercase tracking-wide">
            Competition software that doesn&apos;t fall over on the day
          </p>
          <p className="mt-4 mx-auto max-w-xl text-paper/80">
            Wodflow runs the Rumble Series. At Rumble &ldquo;The Big One&rdquo; it handled sign-ups, ticketing, heats,
            live scoring and results for a full three-day event, with no crashes.
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

        {/* ---------- Proof: real numbers ---------- */}
        <section className="mt-16" aria-label="Rumble The Big One in numbers">
          <h2 className="sticker text-sm">Rumble &ldquo;The Big One&rdquo;, by the numbers</h2>
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-paper/15 bg-black/40 p-5">
                <dt className="font-[family-name:var(--font-display)] text-5xl text-accent leading-none">{s.n}</dt>
                <dd className="mt-2 text-sm text-paper/80">{s.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- Flagship ---------- */}
        <section className="mt-16">
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
              <p className="mt-3 text-paper/90">
                Three events a year, one season leaderboard, a gym-vs-gym Community Cup and a full results archive. All
                on Wodflow, all on Rumble&apos;s own website.
              </p>
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

        {/* ---------- Whole event, start to finish ---------- */}
        <section className="mt-16">
          <h2 className="sticker text-sm">One platform, start to finish</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {stages.map((st) => (
              <div key={st.tag} className="rounded-xl border border-paper/15 bg-black/40 p-6">
                <p className="text-accent font-semibold uppercase tracking-wider text-sm">{st.tag}</p>
                <h3 className="mt-1 text-2xl">{st.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-paper/80 list-disc pl-5">
                  {st.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Your brand ---------- */}
        <section className="mt-16 rounded-xl border border-paper/15 bg-black/40 p-6 sm:p-8">
          <h2 className="text-3xl">Your gym, your brand, your domain</h2>
          <p className="mt-3 text-paper/80 max-w-2xl">
            Your athletes never see &ldquo;Wodflow&rdquo; as the main event. You get your own website address, your own
            colours and logo, and your own events. Wodflow runs quietly underneath, and every improvement we make for
            one gym reaches all of them.
          </p>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="mt-16 text-center">
          <h2 className="text-3xl sm:text-4xl">Host your next comp through us</h2>
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
