import { createClient } from "@/lib/supabase/server";
import { addSeriesEvent, removeSeriesEvent } from "../actions";
import Link from "next/link";

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const supabase = await createClient();

  const [{ data: series }, { data: allEvents }] = await Promise.all([
    supabase
      .from("series")
      .select("id, name, year, series_events(id, sequence, events(id, name, start_date))")
      .eq("id", seriesId)
      .single(),
    supabase.from("events").select("id, name, start_date").order("start_date", { ascending: true }),
  ]);

  function oneOf<T>(value: T | T[] | null | undefined): T | undefined {
    return Array.isArray(value) ? value[0] : (value ?? undefined);
  }

  const assignedEvents = (series?.series_events ?? []).sort((a, b) => a.sequence - b.sequence);
  const assignedEventIds = new Set(
    assignedEvents.map((se) => oneOf(se.events)?.id).filter((id): id is string => !!id)
  );
  const availableEvents = (allEvents ?? []).filter((e) => !assignedEventIds.has(e.id));

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <Link href="/series" className="text-accent text-sm hover:underline">
          ← Series
        </Link>
        <h1 className="text-2xl font-semibold mt-1">
          {series?.name} <span className="text-ink/40 font-normal">({series?.year})</span>
        </h1>
        <Link href={`/series/${seriesId}/leaderboard`} className="text-accent text-sm hover:underline">
          View season leaderboard →
        </Link>
      </div>

      <div className="bg-white border border-ink/10 rounded-xl p-4 space-y-2">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">Events in this series</h2>
        {assignedEvents.map((se) => {
          const event = oneOf(se.events);
          return (
            <div key={se.id} className="flex items-center justify-between text-sm border-t border-ink/5 pt-2">
              <span>
                {se.sequence}. {event?.name} <span className="text-ink/50">({event?.start_date})</span>
              </span>
              <form action={removeSeriesEvent}>
                <input type="hidden" name="seriesId" value={seriesId} />
                <input type="hidden" name="seriesEventId" value={se.id} />
                <button type="submit" className="text-xs text-ink/40 hover:text-ink/70">
                  Remove
                </button>
              </form>
            </div>
          );
        })}
        {assignedEvents.length === 0 && <p className="text-ink/60 text-sm">No events assigned yet.</p>}
      </div>

      <form action={addSeriesEvent} className="bg-white border border-ink/10 rounded-xl p-4 flex items-center gap-3">
        <input type="hidden" name="seriesId" value={seriesId} />
        <select name="eventId" className="flex-1 text-sm border border-ink/10 rounded-lg px-2 py-2">
          {availableEvents.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.start_date})
            </option>
          ))}
        </select>
        <button type="submit" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-semibold shrink-0">
          Add to series
        </button>
      </form>
    </div>
  );
}
