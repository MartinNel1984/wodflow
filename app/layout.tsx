import type { Metadata } from "next";
import { Anton, Hanken_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

// Font pairing chosen for this app specifically, not reused from other
// projects: Anton (heavy condensed display) reads like a scoreboard/
// event banner, Hanken Grotesk is a clean geometric sans for interface
// text, Space Mono carries tabular numerals for times/reps/lane
// numbers — a competition app lives and dies on numbers being legible
// at a glance.
const display = Anton({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Wodflow",
  description: "Competition management for CrossFit events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
