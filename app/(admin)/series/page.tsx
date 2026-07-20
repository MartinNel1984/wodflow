import { createClient } from "@/lib/supabase/server";
import { createSeries } from "./actions";
import Link from "next/link";

export default async function SeriesListPage() {
  const supabase = await createClient();
  const { data: series } = await supabase
    .from("series")
    .select("id, name, year, series_events(id)")
    .order("year", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Series</h1>
        <p className="text-ink/60 text-sm mt-1">
          A season points table across multiple events — e.g. the 2027 Rumble Series.
        </p>
      </div>

      <div className="space-y-3">
        {(series ?? []).map((s) => (
          <Link
            key={s.id}
            href={`/series/${s.id}`}
            className="block bg-white border border-ink/10 rounded-xl px-4 py-3 hover-lift"
          >
            <p className="font-semibold">
              {s.name} <span className="text-ink/40 font-normal">({s.year})</span>
            </p>
            <p className="text-ink/60 text-sm">{(s.series_events ?? []).length} event(s)</p>
          </Link>
        ))}
        {(!series || series.length === 0) && (
          <p className="text-ink/60 text-sm">No series yet — create one below.</p>
        )}
      </div>

      <form action={createSeries} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">New series</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Name</label>
            <input
              name="name"
              required
              placeholder="Rumble Series 2027"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Year</label>
            <input
              name="year"
              type="number"
              required
              defaultValue="2027"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Create series
        </button>
      </form>
    </div>
  );
}
