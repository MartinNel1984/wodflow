import { createPublicClient } from "@/lib/supabase/public";

export type HubDivision = { id: string; name: string };

export type HubPhoto = { id: string; image_url: string; caption: string | null };

export type RumbleHubData = {
  event: {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    venue_name: string | null;
  } | null;
  divisions: HubDivision[];
  isLive: boolean;
  milestones: {
    registrationOpen: boolean;
    heatsReleased: boolean;
    resultsLive: boolean;
  };
  photos: HubPhoto[];
};

// Everything the Rumble hub needs, in one place — "the flagship event"
// is whichever published/live event currently wears the Rumble Big One
// brand kit, not a hardcoded event id, so next year's Big One just
// works once someone reassigns the kit.
export async function getRumbleHubData(): Promise<RumbleHubData> {
  const supabase = createPublicClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, start_date, end_date, venue_name, status, brand_kits!inner(name)")
    .eq("brand_kits.name", "Rumble Big One")
    .in("status", ["published", "live"])
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: photosData } = await supabase
    .from("hub_photos")
    .select("id, image_url, caption")
    .order("sort_order", { ascending: true });

  if (!event) {
    return {
      event: null,
      divisions: [],
      isLive: false,
      milestones: { registrationOpen: false, heatsReleased: false, resultsLive: false },
      photos: photosData ?? [],
    };
  }

  const { data: divisionsData } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("event_id", event.id)
    .order("name", { ascending: true });

  // "RX Test" is leftover rehearsal data on the real Big One event
  // (Martin confirmed 2026-07-29) — excluded from the public hub so
  // it never shows as a real division or trips the news milestones.
  const divisions = (divisionsData ?? []).filter((d) => d.name !== "RX Test");
  const divisionIds = divisions.map((d) => d.id);

  let heatsReleased = false;
  let resultsLive = false;
  if (divisionIds.length > 0) {
    const { data: heats } = await supabase
      .from("heats")
      .select("id, status")
      .in("division_id", divisionIds);
    heatsReleased = (heats ?? []).length > 0;
    resultsLive = (heats ?? []).some((h) => h.status === "completed");
  }

  const today = new Date().toISOString().slice(0, 10);
  const isLive = event.start_date <= today && (event.end_date ?? event.start_date) >= today;

  return {
    event: {
      id: event.id,
      name: event.name,
      start_date: event.start_date,
      end_date: event.end_date,
      venue_name: event.venue_name,
    },
    divisions,
    isLive,
    milestones: { registrationOpen: true, heatsReleased, resultsLive },
    photos: photosData ?? [],
  };
}
