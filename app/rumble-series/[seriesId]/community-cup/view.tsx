"use client";

import { Fragment, useState } from "react";
import type { GymStanding } from "@/lib/communityCup";

const EVENT_COLUMN_ORDER = ["Indy 2026", "Remix 2026", "Rumble In house 2025", "Rumble Indy 2025", "Rumble Teams 2025"];

function orderEventNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const ai = EVENT_COLUMN_ORDER.indexOf(a);
    const bi = EVENT_COLUMN_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

export default function CommunityCupView({
  seriesName,
  seriesYear,
  gyms,
  minAthletes,
}: {
  seriesName: string;
  seriesYear: number;
  gyms: GymStanding[];
  minAthletes: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggle(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-ink/60">Rumble Series</p>
        <h1 className="text-3xl sm:text-4xl font-semibold">{seriesName} {seriesYear} — Community Cup</h1>
        <p className="text-sm text-ink/70 max-w-xl">
          Each team&apos;s event points are split across its athletes&apos; gyms. A pure-gym team sends 100% to that
          gym; a mixed team splits proportionally. Your gym appears here once {minAthletes} athletes
          have signed up for the series.
        </p>
      </header>

      {gyms.length === 0 ? (
        <div className="bg-white border border-ink/10 rounded-xl p-8 text-center text-ink/60">
          No gyms qualified yet — the leaderboard opens as soon as a gym crosses {minAthletes} signed-up athletes.
        </div>
      ) : (
        <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink/5 text-left text-xs uppercase tracking-wider text-ink/60">
                <th className="px-3 py-3 w-12">#</th>
                <th className="px-3 py-3">Gym</th>
                <th className="px-3 py-3 text-right w-24">Athletes</th>
                <th className="px-3 py-3 text-right w-20">Total</th>
                <th className="px-2 py-3 w-6" aria-hidden></th>
              </tr>
            </thead>
            <tbody>
              {gyms.map((g, i) => {
                const key = g.gymId ?? g.gymName;
                const isOpen = expanded === key;
                const eventNames = orderEventNames(Object.keys(g.pointsByEvent));
                return (
                  <Fragment key={key}>
                    <tr
                      className={`border-t border-ink/10 cursor-pointer transition hover:bg-ink/5 ${isOpen ? "bg-ink/5" : ""}`}
                      onClick={() => toggle(key)}
                    >
                      <td className="px-3 py-3 font-data font-bold text-accent">{i + 1}</td>
                      <td className="px-3 py-3 truncate">{g.gymName}</td>
                      <td className="px-3 py-3 text-right text-ink/60 text-xs">{g.distinctAthleteCount}</td>
                      <td className="px-3 py-3 text-right font-data font-bold">{g.totalPoints}</td>
                      <td className="px-2 py-3 text-ink/40 text-xs">
                        <span className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-ink/10 bg-ink/[0.02]">
                        <td colSpan={5} className="px-3 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {eventNames.map((eventName) => (
                              <div key={eventName} className="rounded-md bg-white border border-ink/10 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-wider text-ink/50 leading-tight">{eventName}</div>
                                <div className="font-data font-bold text-ink">{g.pointsByEvent[eventName]}</div>
                              </div>
                            ))}
                            <div className="rounded-md bg-accent/10 border border-accent/30 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-accent leading-tight">Total</div>
                              <div className="font-data font-bold text-accent">{g.totalPoints}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
