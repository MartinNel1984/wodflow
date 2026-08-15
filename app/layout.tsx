import type { Metadata, Viewport } from "next";
import { Anton, Hanken_Grotesk, Space_Mono, Permanent_Marker } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { WodflowBadge } from "@/components/WodflowBadge";
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
// The CI doc's "optional extra" script (also from Nic). Not used
// anywhere on the hub yet — no current section calls for a 4th
// typeface — but registered and ready for whenever it's needed.
const rumbleOptional = localFont({
  src: "./fonts/Rockybilly.ttf",
  variable: "--font-rumble-optional",
});

export const metadata: Metadata = {
  title: "Wodflow",
  description: "Competition management for CrossFit events.",
  icons: {
    apple: "/rumble/apple-touch-icon.png",
  },
  appleWebApp: {
    title: "Rumble",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#14161f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${script.variable} ${rumbleDisplay.variable} ${rumbleHeadline.variable} ${rumbleAccent.variable} ${rumbleOptional.variable}`}
    >
      <body>
        {children}
        <WodflowBadge />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-0EW1XBW8X3"
          strategy="afterInteractive"
        />
        {/* Two separate GA4 properties, one per domain — wodflow.co.za
            is the platform, rumbleinrandburg.co.za is Rumble's own
            marketing domain (same Worker/codebase serves both, see
            wrangler.jsonc's routes), and Martin set up a distinct
            analytics property for the Rumble domain rather than mixing
            its traffic into Wodflow's own. Decided with a plain runtime
            hostname check in the script body (not headers()/middleware
            in the root layout) so this stays purely client-side and
            doesn't force the whole app into dynamic rendering, which
            would break static/ISR caching sitewide. */}
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            var rumbleHosts = ['rumbleinrandburg.co.za', 'www.rumbleinrandburg.co.za'];
            var gaId = rumbleHosts.indexOf(window.location.hostname) !== -1 ? 'G-VVRNLX54GH' : 'G-0EW1XBW8X3';
            gtag('config', gaId);
          `}
        </Script>
      </body>
    </html>
  );
}
