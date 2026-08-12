import { requireOrganizer } from "@/lib/auth";
import { deleteHubPhoto } from "./actions";
import { UploadForm } from "./UploadForm";

export default async function HubPhotosPage() {
  const { supabase, organizationId } = await requireOrganizer();
  // hub_photos' read policy is deliberately public (backs the public
  // marketing carousel), so this admin listing must filter to the
  // caller's own org itself — otherwise every organizer sees (and can
  // see a delete button next to) every other org's photos here.
  const [{ data: photos }, { data: events }, { data: historicalEvents }] = await Promise.all([
    supabase
      .from("hub_photos")
      .select("id, image_url, caption, sort_order, event_id, historical_event_id, events(name), historical_events(name)")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true }),
    // events' own read policy is public too — same cross-org leak risk,
    // same fix (explicit org filter) as the brand_kits picker on the
    // Events admin page.
    supabase
      .from("events")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("start_date", { ascending: false }),
    supabase
      .from("historical_events")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true }),
  ]);

  const groups = new Map<string, { label: string; photos: NonNullable<typeof photos> }>();
  for (const p of photos ?? []) {
    const event = Array.isArray(p.events) ? p.events[0] : p.events;
    const historicalEvent = Array.isArray(p.historical_events) ? p.historical_events[0] : p.historical_events;
    const key = p.event_id ?? p.historical_event_id ?? "none";
    const label = event?.name ?? historicalEvent?.name ?? "General (homepage carousel)";
    if (!groups.has(key)) groups.set(key, { label, photos: [] });
    groups.get(key)!.photos.push(p);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Rumble hub photos</h1>
        <p className="text-ink/60 text-sm mt-1">
          Photos tagged to an event show in that event&apos;s archive on the athlete portal. Untagged
          photos only show in the homepage &ldquo;From the Floor&rdquo; carousel.
        </p>
      </div>

      {[...groups.values()].map((group) => (
        <div key={group.label} className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">{group.label}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {group.photos.map((p) => (
              <div key={p.id} className="bg-white border border-ink/10 rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={p.caption ?? ""} className="w-full aspect-square object-cover" />
                <div className="p-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-ink/60 truncate">{p.caption || "—"}</p>
                  <form action={deleteHubPhoto}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-xs text-ink/40 hover:text-red-700 shrink-0">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {(!photos || photos.length === 0) && <p className="text-ink/60 text-sm">No photos yet — add one below.</p>}

      <UploadForm organizationId={organizationId} events={events ?? []} historicalEvents={historicalEvents ?? []} />
    </div>
  );
}
