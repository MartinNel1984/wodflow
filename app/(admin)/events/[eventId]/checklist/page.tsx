import { createClient } from "@/lib/supabase/server";

type CheckItem = { label: string; ok: boolean; detail?: string };

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: divisions }] = await Promise.all([
    supabase
      .from("events")
      .select("name, venue_name, venue_address, contact_email, contact_phone, waiver_text, status")
      .eq("id", eventId)
      .single(),
    supabase
      .from("divisions")
      .select("id, name, lane_count, heat_duration_minutes, price_normal")
      .eq("event_id", eventId),
  ]);

  const eventChecks: CheckItem[] = [
    { label: "Venue name set", ok: !!event?.venue_name },
    { label: "Venue address set", ok: !!event?.venue_address },
    { label: "Contact email set", ok: !!event?.contact_email },
    { label: "Contact phone set", ok: !!event?.contact_phone },
    { label: "Waiver text set", ok: !!event?.waiver_text },
    { label: "At least one division exists", ok: (divisions?.length ?? 0) > 0 },
  ];

  const divisionChecks: (CheckItem & { divisionName: string })[] = (divisions ?? []).flatMap((d) => [
    { divisionName: d.name, label: "Lane count set", ok: !!d.lane_count },
    { divisionName: d.name, label: "Heat duration set", ok: !!d.heat_duration_minutes },
    { divisionName: d.name, label: "Price set", ok: d.price_normal > 0, detail: `R${d.price_normal}` },
  ]);

  const allChecks = [...eventChecks, ...divisionChecks];
  const failCount = allChecks.filter((c) => !c.ok).length;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <a href="/events" className="text-accent text-sm hover:underline">
          ← Events
        </a>
        <h1 className="text-2xl font-semibold mt-1">{event?.name ?? "Event"} — Pre-event checklist</h1>
        <p className="text-ink/60 text-sm mt-1">
          Run this the day before — this is exactly what was missing on the ScoreIT event that
          broke: an event days away with no address, contact, or config filled in.
        </p>
      </div>

      <div
        className={`rounded-xl p-4 font-semibold text-sm ${
          failCount === 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {failCount === 0 ? "All checks passed — ready to go." : `${failCount} item(s) need attention.`}
      </div>

      <div className="bg-white border border-ink/10 rounded-xl p-4 space-y-2">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">Event</h2>
        {eventChecks.map((c) => (
          <CheckRow key={c.label} item={c} />
        ))}
      </div>

      {(divisions ?? []).map((d) => (
        <div key={d.id} className="bg-white border border-ink/10 rounded-xl p-4 space-y-2">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">{d.name}</h2>
          {divisionChecks
            .filter((c) => c.divisionName === d.name)
            .map((c) => (
              <CheckRow key={`${d.id}-${c.label}`} item={c} />
            ))}
        </div>
      ))}
    </div>
  );
}

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{item.label}</span>
      <span className={item.ok ? "text-green-700" : "text-amber-700 font-semibold"}>
        {item.ok ? "✓" : "Missing"}
      </span>
    </div>
  );
}
