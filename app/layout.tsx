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

// Rumble hub only, below. All three are the real CI-doc fonts now,
// sourced from Nic at ATG (who already licenses/uses them across
// their own marketing): Punch Condensed for tight UI labels/buttons,
// Zombie Punks (bolder brush) for section headlines, Street Punks
// Marker (thinner brush) for the tagline/script accent.
const rumbleDisplay = localFont({
  src: "./fonts/PunchCondensed.otf",
  variable: "--font-rumble-display",
});
const rumbleHeadline = localFont({
  src: "./fonts/ZombiePunks.otf",
  variable: "--font-rumble-headline",
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
      className={`${display.variable} ${sans.variable} ${mono.variable} ${script.variable} ${rumbleDisplay.variable} ${rumbleHeadline.variable} ${rumbleAccent.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
