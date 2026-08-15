import type { MetadataRoute } from "next";

// Lets an athlete "Add to Home Screen" and get a real app-style icon +
// standalone window (no browser address bar) instead of a generic
// bookmark. start_url is /portal (not /) so the icon opens straight
// into My Wodflow for an already-logged-in athlete — the marketing
// homepage isn't useful as a repeat destination once someone's signed
// up. One manifest for the whole app (Rumble-branded) since the
// organizer/admin side is desktop-first and doesn't need its own.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rumble Series",
    short_name: "Rumble",
    description: "Athlete portal for the Rumble Series — leaderboards, heats, notices and more.",
    start_url: "/portal",
    display: "standalone",
    background_color: "#14161f",
    theme_color: "#14161f",
    icons: [
      { src: "/rumble/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/rumble/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/rumble/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
