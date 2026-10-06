import { RumbleBackdrop } from "@/components/RumbleBackdrop";

// Wide "one column per event" table for screen-recording walkthroughs.
// Replaces the carousel/drill-down for cases where Tjokkie wants every
// event visible at once. Events missing for a row render as 0.

const EVENT_COLUMN_ORDER = ["Indy 2026", "Remix 2026", "Rumble In house 2025", "Rumble Indy 2025", "Rumble Teams 2025"];

export function orderEventNames(names: Iterable<string>): string[] {
  return [...new Set(names)].sort((a, b) => {
    const ai = EVENT_COLUMN_ORDER.indexOf(a);
    const bi = EVENT_COLUMN_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

// Column heading only (data stays keyed by the real event name). The Big One's
// full name is much wider than "Indy 2026"/"Remix 2026" and stretched its column.
function headingFor(event: string): string {
  return /big one/i.test(event) ? "The Big One 2026" : event;
}

export type EventTableRow = {
  key: string;
  name: string;
  sub?: string;
  pointsByEvent: Record<string, number>;
  total: number;
};

export default function EventTable({
  seriesName,
  seriesYear,
  title,
  nameHeading,
  rows,
  emptyText,
}: {
  seriesName: string;
  seriesYear: number;
  title: string;
  nameHeading: string;
  rows: EventTableRow[];
  emptyText: string;
}) {
  const events = orderEventNames(rows.flatMap((r) => Object.keys(r.pointsByEvent)));
  const shortName = seriesName.replace(new RegExp(`\\s*${seriesYear}$`), "");

  return (
    <RumbleBackdrop logoSrc="/rumble/series-logo-v2.png" logoAlt={seriesName}>
      <div className="w-full max-w-5xl bg-white text-ink rounded-2xl shadow-xl px-3 sm:px-6 py-8 space-y-6">
        <header className="text-center space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
            {shortName} {seriesYear}
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold uppercase">{title}</h1>
        </header>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-ink/10 p-8 text-center text-ink/60">{emptyText}</div>
        ) : (
          <div className="rounded-xl border border-ink/10 overflow-x-auto">
            <table className="w-full min-w-[38rem] table-fixed text-sm">
              <thead>
                <tr className="bg-ink/5 text-left">
                  <th className="px-3 py-3 w-12">#</th>
                  <th className="px-3 py-3">{nameHeading}</th>
                  {events.map((e) => (
                    <th key={e} className="px-3 py-3 text-right font-semibold leading-tight w-36">
                      {headingFor(e)}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-bold w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} className={`border-t border-ink/10 ${i < 3 ? "bg-accent/5" : ""}`}>
                    <td className="px-3 py-3 font-data font-bold text-accent">{i + 1}</td>
                    <td className="px-3 py-3 font-semibold truncate">
                      {r.name}
                      {r.sub && <span className="block text-xs font-normal text-ink/50">{r.sub}</span>}
                    </td>
                    {events.map((e) => (
                      <td key={e} className="px-3 py-3 text-right font-data tabular-nums">
                        {r.pointsByEvent[e] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-data font-bold tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RumbleBackdrop>
  );
}
