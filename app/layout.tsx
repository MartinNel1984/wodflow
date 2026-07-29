import type { Metadata } from "next";
import { Anton, Hanken_Grotesk, Space_Mono, Permanent_Marker } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Font pairing chosen for this app specifically, not reused from other
// projects: Anton (heavy condensed display) reads like a scoreboard/
// event banner, Hanken Grotesk is a clean geometric sans for interface
// text, Space Mono carries tabular numerals for times/reps/lane
// numbers — a competition app lives and dies on numbers being legible
// at a glance. Permanent Marker is DESIGN EXPLORATION only, for the
// hand-brushed mural-quote treatment on the landing page.
const display = Anton({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });
const script = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-script" });

// Rumble hub only, below. Both are the real CI-doc fonts now: Punch
// Condensed (freeware, commercial use asks for a donation to the
// author) and Street Punks Marker (Christopher King / Wingsart Studio
// — commercial-license font, sourced directly from Nic at ATG, who
// already uses it across their own marketing). "Zombie Punks" still
// isn't in hand — the wordmark itself lives inside the logo artwork,
// not as live text, so nothing on the page actually needs it yet.
const rumbleDisplay = localFont({
  src: "./fonts/PunchCondensed.otf",
  variable: "--font-rumble-display",
});
const rumbleAccent = localFont({
  src: "./fonts/StreetPunksMarker.ttf",
  variable: "--font-rumble-accent",
});

export const metadata: Metadata = {
  title: "Wodflow",
  description: "Competition management for CrossFit events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${script.variable} ${rumbleDisplay.variable} ${rumbleAccent.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
