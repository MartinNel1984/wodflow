import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";

// wodflow.co.za and rumbleinrandburg.co.za share this Worker (see
// wrangler.jsonc routes). Each host advertises its own URLs, matching the
// self-canonical Link header set in middleware.ts. Anything else (workers.dev,
// previews) falls back to wodflow.co.za.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const BASE_URL = host === "rumbleinrandburg.co.za" ? "https://rumbleinrandburg.co.za" : "https://wodflow.co.za";
  const supabase = createPublicClient();

  const [{ data: events }, { data: historicalEvents }] = await Promise.all([
    supabase.from("events").select("id"),
    supabase.from("historical_events").select("id"),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, priority: 1 },
    { url: `${BASE_URL}/all-events`, priority: 0.8 },
    { url: `${BASE_URL}/past-rumbles`, priority: 0.6 },
    { url: `${BASE_URL}/tickets`, priority: 0.3 },
  ];

  const eventRoutes: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
    url: `${BASE_URL}/events/${e.id}`,
    priority: 0.8,
  }));

  const pastRumbleRoutes: MetadataRoute.Sitemap = (historicalEvents ?? []).map((e) => ({
    url: `${BASE_URL}/past-rumbles/${e.id}`,
    priority: 0.5,
  }));

  return [...staticRoutes, ...eventRoutes, ...pastRumbleRoutes];
}
