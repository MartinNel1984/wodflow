import { requireOrganizer } from "@/lib/auth";
import { addHistoricalResult, removeHistoricalResult } from "./actions";

export default async function HistoricalResultsPage() {
  const { supabase, organizationId } = await requireOrganizer();

  const { data: results } = await supabase
    .from("historical_results")
    .select("id, event_name, division_name, team_name, athlete_name, athlete_email, position, entrants")
    .eq("organization_id", organizationId)
    .order("event_name", { ascending: true })
    .order("division_name", { ascending: true })
    .order("position", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Historical results</h1>
        <p className="text-ink/60 text-sm mt-1">
          Placements from events run outside Wodflow (e.g. Indy, Remix) — matched to an athlete&apos;s
          Wodflow account by email, so they show up on that athlete&apos;s own portal (Best Finishes +
          Season Rank) once they&apos;ve signed up. No match yet? The row just waits.
        </p>
      </div>

      <form action={addHistoricalResult} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Add a result</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Event name</label>
            <input
              type="text"
              name="eventName"
              required
              placeholder="Remix 2026"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Division</label>
            <input
              type="text"
              name="divisionName"
              required
              placeholder="RX"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
            Team name (optional)
          </label>
          <input
            type="text"
            name="teamName"
            className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              Athlete name
            </label>
            <input
              type="text"
              name="athleteName"
              required
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              Athlete email
            </label>
            <input
              type="email"
              name="athleteEmail"
              required
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Placement</label>
            <input
              type="number"
              name="position"
              min={1}
              required
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              Total entrants
            </label>
            <input
              type="number"
              name="entrants"
              min={1}
              required
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Add result
        </button>
      </form>

      <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink/5 text-left">
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">Division</th>
              <th className="px-4 py-2">Athlete</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Placement</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(results ?? []).map((r) => (
              <tr key={r.id} className="border-t border-ink/10">
                <td className="px-4 py-2">{r.event_name}</td>
                <td className="px-4 py-2 text-ink/60">
                  {r.division_name}
                  {r.team_name ? ` · ${r.team_name}` : ""}
                </td>
                <td className="px-4 py-2">{r.athlete_name}</td>
                <td className="px-4 py-2 text-ink/60 font-data">{r.athlete_email}</td>
                <td className="px-4 py-2 font-data">
                  {r.position} / {r.entrants}
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={removeHistoricalResult}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-xs text-ink/40 hover:text-ink/70">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(results ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/60 text-sm">
                  No historical results yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
