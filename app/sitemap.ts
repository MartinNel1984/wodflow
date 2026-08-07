import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";

// wodflow.co.za and rumbleinrandburg.co.za share this Worker (see
// wrangler.jsonc routes) — the sitemap always advertises the primary
// domain since that's what's registered in Search Console.
const BASE_URL = "https://wodflow.co.za";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
