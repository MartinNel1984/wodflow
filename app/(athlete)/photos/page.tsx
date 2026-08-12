import { createClient } from "@/lib/supabase/server";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { AthleteHeroLogo } from "@/components/AthleteHeroLogo";

export default async function AthletePhotosPage() {
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("hub_photos")
    .select("id, image_url, caption, event_id, events(name, start_date)")
    .order("sort_order", { ascending: true });

  const highlights = (photos ?? []).filter((p) => !p.event_id);

  // Group event-tagged photos by event, most recent event first.
  const eventGroups = new Map<
    string,
    { eventName: string; startDate: string; photos: NonNullable<typeof photos> }
  >();
  for (const p of photos ?? []) {
    if (!p.event_id) continue;
    const event = Array.isArray(p.events) ? p.events[0] : p.events;
    if (!event) continue;
    if (!eventGroups.has(p.event_id)) {
      eventGroups.set(p.event_id, { eventName: event.name, startDate: event.start_date, photos: [] });
    }
    eventGroups.get(p.event_id)!.photos.push(p);
  }
  const orderedEventGroups = [...eventGroups.values()].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <AthleteHeroLogo />
      <h1 className="text-2xl font-semibold text-paper">From the Floor</h1>

      {highlights.length > 0 && <PhotoCarousel photos={highlights} />}

      {orderedEventGroups.length > 0 ? (
        <div className="space-y-8">
          {orderedEventGroups.map((group) => (
            <div key={group.eventName + group.startDate} className="space-y-3">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-paper/50">
                {group.eventName}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {group.photos.map((p) => (
                  <a
                    key={p.id}
                    href={`/api/photos/${p.id}/download`}
                    className="block bg-white border-2 border-ink rounded-xl overflow-hidden hover-lift"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url}
                      alt={p.caption ?? ""}
                      className="w-full aspect-square object-cover"
                    />
                    <p className="text-ink/70 text-xs text-center py-1.5 font-semibold">Download ↓</p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        highlights.length === 0 && (
          <p className="text-paper/60 text-sm text-center py-10">No photos posted yet.</p>
        )
      )}
    </div>
  );
}
