import { createClient } from "@/lib/supabase/server";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { AthleteHeroLogo } from "@/components/AthleteHeroLogo";
import { PhotoEventPicker } from "@/components/PhotoEventPicker";

export default async function AthletePhotosPage() {
  const supabase = await createClient();

  const [{ data: highlights }, { data: events }, { data: historicalEvents }] = await Promise.all([
    // A handful of untagged photos for the "From the Floor" carousel —
    // capped, since this is meant to stay a small highlight reel, not
    // grow unbounded like the per-event archive below.
    supabase
      .from("hub_photos")
      .select("id, image_url, caption")
      .is("event_id", null)
      .is("historical_event_id", null)
      .order("sort_order", { ascending: true })
      .limit(30),
    supabase.from("events").select("id, name, start_date"),
    supabase.from("historical_events").select("id, name, event_date"),
  ]);

  // Per-event photo counts only (head:true — no rows transferred, so
  // this can't hit PostgREST's 1000-row cap even once the archive
  // grows well past that). The actual photos for a given event load
  // lazily, only once its tab is picked — see PhotoEventPicker.
  const groups = (
    await Promise.all([
      ...(events ?? []).map(async (e) => {
        const { count } = await supabase
          .from("hub_photos")
          .select("id", { count: "exact", head: true })
          .eq("event_id", e.id);
        return count ? { id: e.id, type: "event" as const, eventName: e.name, dateKey: e.start_date, count } : null;
      }),
      ...(historicalEvents ?? []).map(async (e) => {
        const { count } = await supabase
          .from("hub_photos")
          .select("id", { count: "exact", head: true })
          .eq("historical_event_id", e.id);
        return count
          ? { id: e.id, type: "historical" as const, eventName: e.name, dateKey: e.event_date ?? "", count }
          : null;
      }),
    ])
  )
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <AthleteHeroLogo />
      <h1 className="text-2xl font-semibold text-paper">From the Floor</h1>

      {highlights && highlights.length > 0 && <PhotoCarousel photos={highlights} />}

      {groups.length > 0 ? (
        <PhotoEventPicker groups={groups} />
      ) : (
        (!highlights || highlights.length === 0) && (
          <p className="text-paper/60 text-sm text-center py-10">No photos posted yet.</p>
        )
      )}
    </div>
  );
}
