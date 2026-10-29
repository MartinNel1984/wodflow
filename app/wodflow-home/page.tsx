import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CountUp } from "@/components/CountUp";
import { Reveal } from "@/components/Reveal";
import { contactHref } from "@/lib/contact";

// Rendered for wodflow.co.za/ only: middleware.ts rewrites "/" here on that
// host, so rumbleinrandburg.co.za keeps serving app/page.tsx untouched.
export const metadata: Metadata = {
  title: "Wodflow | Run your CrossFit competition like the Rumble",
  description:
    "Sign-ups, heats, judging, live leaderboards and spectator tickets in one platform. It ran Rumble “The Big One”: 76 teams, 462 scores, 174 spectators, three days, no crashes.",
};

const RUMBLE_URL = "https://rumbleinrandburg.co.za";

// Real figures from Rumble "The Big One" (2–4 Oct 2026), read from the live database.
const scoreboard = [
  { n: 76, label: "teams signed up and paid online" },
  { n: 152, label: "athletes on the floor" },
  { n: 54, label: "heats run" },
  { n: 462, label: "scores captured by judges" },
  { n: 174, label: "spectators ticketed" },
  { n: 0, label: "crashes in three days" },
];

const stages = [
  {
    no: "01",
    title: "Sign-ups that run themselves",
    body: "Teams pick their division, pay by PayFast and sign the waiver before they ever arrive. Early-bird pricing switches off on its own. Athletes choose their gym from your approved list, so the gym leaderboard is clean from day one.",
    proof: "76 teams paid online",
    photo: "8",
    alt: "Two smiling athletes with lifting belts",
  },
  {
    no: "02",
    title: "Heats and lanes in minutes",
    body: "Generate the schedule, seed it, publish it. The best seed lands in the middle lane, and later heats re-seed by rank so the leaders end up in the final heat. Athletes find their heat on their phone.",
    proof: "54 heats across the weekend",
    photo: "3",
    alt: "Athletes training on the competition floor",
  },
  {
    no: "03",
    title: "Judges score on their phones, signal or not",
    body: "Judges log in with a name and a four-digit PIN. If the signal drops mid-WOD, every score saves on the phone and syncs the moment it's back. Capped workouts break ties on time at the last rep.",
    proof: "462 scores captured",
    photo: "4",
    alt: "Two athletes holding dumbbells overhead",
  },
  {
    no: "04",
    title: "A leaderboard the whole hall can follow",
    body: "It updates on its own as scores come in, per division, on every phone. Tied overall? Count-back on best finishes, like the CrossFit Open. A big-screen mode fills the venue TV.",
    proof: "Live on every phone, no refresh",
    photo: "5",
    alt: "Athlete in a handstand",
  },
  {
    no: "05",
    title: "Tickets with a real gate",
    body: "Spectators buy online and get a QR ticket straight away. Your volunteers scan at the door with any phone. Single-day tickets and weekend passes, no cash box and no oversold hall.",
    proof: "174 sold, 84 scanned at the door",
    photo: "7",
    alt: "Two athletes in front of the crowd seating",
  },
  {
    no: "06",
    title: "The event ends. The season doesn't.",
    body: "Every athlete keeps an account with their history and best finishes. Points carry across the whole series, plus a gym-vs-gym Community Cup. Thousands of event photos sit right next to the results.",
    proof: "Season standings + Community Cup",
    photo: "1",
    alt: "Athlete climbing a rope",
  },
];

const asked = [
  "Best seed goes in the middle lane, then alternates outward.",
  "Capped workout? Whoever reached the last rep first wins the tie.",
  "Names misspelt? The organiser fixes it in two taps, live on the public leaderboard.",
  "Gym leaderboard that can't be gamed by typos: every athlete picks their gym from your list.",
  "Delete a rehearsal event and start clean the night before.",
];

export default function WodflowHomePage() {
  const external = contactHref.startsWith("https://");
  return (
    <main className="wf-home bg-[#0c0d10] text-paper">
      {/* ---------- Hero ---------- */}
      <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/rumble/photos/photo-9.jpg"
          alt="The crowd of athletes and spectators at Rumble The Big One"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_35%]"
        />
        <div className="wf-hero-shade absolute inset-0 -z-10" aria-hidden="true" />

        <header className="absolute left-0 right-0 top-0 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
          <span className="text-2xl">
            <Logo />
          </span>
          <a
            href={RUMBLE_URL}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-paper/80 hover:text-paper"
          >
            See it live: Rumble ↗
          </a>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-32 sm:pb-14">
          <Reveal>
            <p className="inline-block bg-[#0c0d10]/85 px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.22em] text-paper sm:text-sm">
              <span className="text-accent">●</span> The platform behind the Rumble Series
            </p>
            <h1
              className="mt-4 font-[family-name:var(--font-display)] uppercase leading-[0.88] tracking-[0.005em]"
              style={{ fontSize: "clamp(3.4rem, 12.5vw, 10rem)" }}
            >
              Run your comp
              <br />
              like <span className="text-accent">the Rumble.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-paper/85 sm:text-xl">
              Sign-ups, heats, judging, live leaderboards and spectator tickets, in one place. It ran Rumble &ldquo;The
              Big One&rdquo; for three days without a crash.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href={contactHref}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="wf-cta inline-flex items-center gap-3 bg-accent px-8 py-4 text-base font-bold uppercase tracking-wider text-white sm:text-lg"
              >
                WhatsApp us your date <span aria-hidden="true">→</span>
              </a>
              <a
                href={RUMBLE_URL}
                className="text-base font-semibold uppercase tracking-wider text-paper underline decoration-accent decoration-2 underline-offset-8 sm:text-lg"
              >
                See it running
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Scoreboard ---------- */}
      <section aria-label="Rumble The Big One, final scoreboard" className="relative z-10 -mt-px border-y border-paper/15 bg-[#0c0d10]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-paper/60 sm:text-sm">
            <span>Rumble &ldquo;The Big One&rdquo; · 2–4 Oct 2026</span>
            <span className="text-accent">● Final</span>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {scoreboard.map((s) => (
              <div key={s.label} className="border-l-2 border-accent pl-4">
                <dt
                  className="font-[family-name:var(--font-display)] leading-none text-paper"
                  style={{ fontSize: "clamp(3rem, 7vw, 5rem)" }}
                >
                  <CountUp to={s.n} />
                </dt>
                <dd className="mt-2 text-sm leading-snug text-paper/70">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- Start to finish ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <h2 className="sticker text-sm">The whole event, start to finish</h2>
          <p
            className="mt-6 max-w-3xl font-[family-name:var(--font-display)] uppercase leading-[0.95]"
            style={{ fontSize: "clamp(2rem, 5.5vw, 4rem)" }}
          >
            No more spreadsheets, WhatsApp groups and paper scoresheets.
          </p>
        </Reveal>

        <ol className="mt-14">
          {stages.map((st, i) => (
            <li key={st.no} className="border-t border-paper/15 py-10 sm:py-14">
              <Reveal className="grid items-center gap-8 md:grid-cols-12">
                <div
                  className={`md:col-span-7 ${i % 2 === 1 ? "md:order-2 md:col-start-6" : ""}`}
                >
                  <span className="wf-outline font-[family-name:var(--font-display)] text-7xl leading-none sm:text-8xl">
                    {st.no}
                  </span>
                  <h3
                    className="mt-3 font-[family-name:var(--font-display)] uppercase leading-[1]"
                    style={{ fontSize: "clamp(1.9rem, 4vw, 3.1rem)" }}
                  >
                    {st.title}
                  </h3>
                  <p className="mt-4 max-w-xl text-base text-paper/80 sm:text-lg">{st.body}</p>
                  <p className="mt-5 inline-block bg-paper px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wider text-ink sm:text-sm">
                    {st.proof}
                  </p>
                </div>
                <div className={`md:col-span-5 ${i % 2 === 1 ? "md:order-1 md:col-start-1 md:row-start-1" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/rumble/photos/photo-${st.photo}.jpg`}
                    alt={st.alt}
                    loading="lazy"
                    decoding="async"
                    className={`w-full object-cover ${i % 3 === 0 ? "aspect-[4/5]" : i % 3 === 1 ? "aspect-[1/1]" : "aspect-[5/6]"} ${
                      i % 2 === 1 ? "md:-rotate-1" : "md:rotate-1"
                    }`}
                  />
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Asked for by organisers ---------- */}
      <section className="wf-glow border-y border-paper/15">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:py-24 md:grid-cols-12">
          <Reveal className="md:col-span-5">
            <h2 className="sticker text-sm">Built on the floor</h2>
            <p
              className="mt-6 font-[family-name:var(--font-display)] uppercase leading-[0.95]"
              style={{ fontSize: "clamp(2rem, 4.6vw, 3.6rem)" }}
            >
              Every feature here exists because an organiser asked.
            </p>
            <p className="mt-5 text-paper/75">
              Wodflow wasn&apos;t designed in a meeting room. It was built next to the people running Rumble and fixed
              on event weekends. That&apos;s what you get when you run your comp on it.
            </p>
          </Reveal>
          <Reveal className="md:col-span-7" delay={120}>
            <ul className="divide-y divide-paper/15 border-y border-paper/15">
              {asked.map((a) => (
                <li key={a} className="flex gap-4 py-5 text-lg text-paper/90">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 bg-accent" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ---------- Your brand ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal className="grid items-center gap-10 md:grid-cols-12">
          <div className="md:col-span-6">
            <h2 className="sticker text-sm">Your gym, not ours</h2>
            <p
              className="mt-6 font-[family-name:var(--font-display)] uppercase leading-[0.95]"
              style={{ fontSize: "clamp(2rem, 4.6vw, 3.6rem)" }}
            >
              Your name. Your colours. Your own web address.
            </p>
            <p className="mt-5 max-w-lg text-lg text-paper/80">
              Your athletes land on your site, not a software brand. Wodflow runs quietly underneath, and every
              improvement we make for one gym reaches all of them.
            </p>
          </div>
          <div className="md:col-span-6">
            <div className="border-2 border-paper/25 bg-black/50">
              <div className="flex items-center gap-2 border-b-2 border-paper/25 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-paper/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-paper/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-paper/30" />
                <span className="ml-3 truncate bg-paper/10 px-3 py-1 font-[family-name:var(--font-mono)] text-xs text-paper/80 sm:text-sm">
                  rumbleinrandburg.co.za
                </span>
              </div>
              <div className="grid grid-cols-3">
                {["2", "6", "9"].map((n) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={n}
                    src={`/rumble/photos/photo-${n}.jpg`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-[3/4] w-full object-cover"
                  />
                ))}
              </div>
              <p className="px-4 py-3 text-sm text-paper/70">
                Rumble&apos;s own website. It runs on Wodflow, and its athletes never need to know.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- Close ---------- */}
      <section className="border-t border-paper/15 bg-accent text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <Reveal>
            <h2
              className="font-[family-name:var(--font-display)] uppercase leading-[0.9]"
              style={{ fontSize: "clamp(3rem, 10vw, 8rem)" }}
            >
              Got a date?
            </h2>
            <p className="mt-5 max-w-xl text-lg sm:text-xl">
              Tell us the date, your gym and about how many athletes. We&apos;ll tell you exactly what it costs and how
              the weekend would run.
            </p>
            <a
              href={contactHref}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="wf-cta mt-8 inline-flex items-center gap-3 bg-[#0c0d10] px-8 py-4 text-base font-bold uppercase tracking-wider text-white sm:text-lg"
            >
              WhatsApp us your date <span aria-hidden="true">→</span>
            </a>
          </Reveal>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-paper/60">
        <span className="text-lg text-paper">
          <Logo />
        </span>
        <span>
          Already on Wodflow? <Link href="/login" className="underline">Organiser sign-in</Link> ·{" "}
          <Link href="/athlete-login" className="underline">Athlete sign-in</Link>
        </span>
      </footer>
    </main>
  );
}
