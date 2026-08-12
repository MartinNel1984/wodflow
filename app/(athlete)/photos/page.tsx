import { createClient } from "@/lib/supabase/server";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { AthleteHeroLogo } from "@/components/AthleteHeroLogo";
import { PhotoEventPicker } from "@/components/PhotoEventPicker";

export default async function AthletePhotosPage() {
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("hub_photos")
    .select(
      "id, image_url, caption, event_id, historical_event_id, events(name, start_date), historical_events(name, event_date)"
    )
    .order("sort_order", { ascending: true });

  const highlights = (photos ?? []).filter((p) => !p.event_id && !p.historical_event_id);

  // Group event-tagged photos by event (live Wodflow events and
  // pre-Wodflow "Past Rumbles" events both show here — an athlete
  // browsing the archive doesn't care which table a past event lives
  // in), most recent first. Undated historical events sort last.
  const eventGroups = new Map<
    string,
    { eventName: string; dateKey: string; photos: NonNullable<typeof photos> }
  >();
  for (const p of photos ?? []) {
    const key = p.event_id ?? p.historical_event_id;
    if (!key) continue;
    if (!eventGroups.has(key)) {
      const event = Array.isArray(p.events) ? p.events[0] : p.events;
      const historicalEvent = Array.isArray(p.historical_events) ? p.historical_events[0] : p.historical_events;
      const eventName = event?.name ?? historicalEvent?.name;
      if (!eventName) continue;
      eventGroups.set(key, {
        eventName,
        dateKey: event?.start_date ?? historicalEvent?.event_date ?? "",
        photos: [],
      });
    }
    eventGroups.get(key)!.photos.push(p);
  }
  const orderedEventGroups = [...eventGroups.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <AthleteHeroLogo />
      <h1 className="text-2xl font-semibold text-paper">From the Floor</h1>

      {highlights.length > 0 && <PhotoCarousel photos={highlights} />}

      {orderedEventGroups.length > 0 ? (
        <PhotoEventPicker groups={orderedEventGroups} />
      ) : (
        highlights.length === 0 && (
          <p className="text-paper/60 text-sm text-center py-10">No photos posted yet.</p>
        )
      )}
    </div>
  );
}
