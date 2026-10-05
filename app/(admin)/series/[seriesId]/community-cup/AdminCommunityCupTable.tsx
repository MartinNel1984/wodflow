"use client";

import { Fragment, useState } from "react";
import type { GymEventContribution, GymStanding } from "@/lib/communityCup";

const EVENT_COLUMN_ORDER = [
  "Indy 2026",
  "Remix 2026",
  "Rumble In house 2025",
  "Rumble Indy 2025",
  "Rumble Teams 2025",
];

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

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function StatusBadge({
  gym,
  minAthletes,
}: {
  gym: Pick<GymStanding, "approved" | "eligible" | "distinctAthleteCount">;
  minAthletes: number;
}) {
  if (!gym.approved) {
    return <span className="text-xs rounded-full bg-ink/10 text-ink/60 px-2 py-0.5">Pending</span>;
  }
  if (!gym.eligible) {
    return (
      <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
        {gym.distinctAthleteCount}/{minAthletes}
      </span>
    );
  }
  return <span className="text-xs rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">Public</span>;
}

function ContributionLine({ c }: { c: GymEventContribution }) {
  if (c.kind === "team") {
    const rosterLabel = c.athleteNames.length
      ? c.athleteNames.join(", ")
      : `${c.slotsFromThisGym} teammate${c.slotsFromThisGym === 1 ? "" : "s"}`;
    return (
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4 border-t border-ink/5 py-2 first:border-t-0">
        <div className="min-w-0">
          <div className="font-semibold text-ink truncate">{c.teamName}</div>
          <div className="text-ink/60 text-xs">
            {ordinal(c.position)} / {c.entrants} teams
            <span className="text-ink/40"> · </span>
            {rosterLabel}
          </div>
        </div>
        <div className="shrink-0 font-data text-xs text-ink/70 sm:text-right">
          {c.seriesPointsForTeam} pts × {c.slotsFromThisGym}/{c.teamSize}
          <span className="font-bold text-ink ml-2">= {c.pointsCredited}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4 border-t border-ink/5 py-2 first:border-t-0">
      <div className="min-w-0">
        <div className="font-semibold text-ink truncate">{c.athleteName}</div>
        <div className="text-ink/60 text-xs">
          {ordinal(c.position)} / {c.entrants}
        </div>
      </div>
      <div className="shrink-0 font-data text-xs font-bold text-ink sm:text-right">
        {c.pointsCredited} pts
      </div>
    </div>
  );
}

export default function AdminCommunityCupTable({
  gyms,
  minAthletes,
}: {
  gyms: GymStanding[];
  minAthletes: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggle(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  // Union of event names across all gyms for the summary columns —
  // keeps the per-row event cells aligned so Tjokkie can scan across
  // gyms for a single event.
  const allEventNames = new Set<string>();
  for (const g of gyms) {
    for (const n of Object.keys(g.pointsByEvent)) allEventNames.add(n);
  }
  const eventColumnOrder = orderEventNames([...allEventNames]);

  return (
    <div className="bg-white border border-ink/10 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ink/5 text-left text-xs uppercase tracking-wider text-ink/60 align-bottom">
            <th className="px-3 py-3">Gym</th>
            <th className="px-3 py-3 text-right">Athletes</th>
            {eventColumnOrder.map((n) => (
              <th
                key={n}
                className="px-2 py-3 text-right whitespace-normal break-words text-[10px] leading-tight"
              >
                {n}
              </th>
            ))}
            <th className="px-3 py-3 text-right">Total</th>
            <th className="px-3 py-3 text-right">Status</th>
            <th className="px-2 py-3 w-6" aria-hidden></th>
          </tr>
        </thead>
        <tbody>
          {gyms.map((g) => {
            const key = g.gymId ?? g.gymName;
            const isOpen = expanded === key;
            const drillEventNames = orderEventNames(Object.keys(g.pointsByEvent));
            return (
              <Fragment key={key}>
                <tr
                  className={`border-t border-ink/10 cursor-pointer transition hover:bg-ink/5 ${isOpen ? "bg-ink/5" : ""}`}
                  onClick={() => toggle(key)}
                >
                  <td className="px-3 py-2">{g.gymName}</td>
                  <td className="px-3 py-2 text-right font-data">{g.distinctAthleteCount}</td>
                  {eventColumnOrder.map((n) => (
                    <td key={n} className="px-2 py-2 text-right font-data text-ink/70 text-xs">
                      {g.pointsByEvent[n] ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-data font-bold">{g.totalPoints}</td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge gym={g} minAthletes={minAthletes} />
                  </td>
                  <td className="px-2 py-2 text-ink/40 text-xs">
                    <span className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-t border-ink/10 bg-ink/[0.02]">
                    <td colSpan={5 + eventColumnOrder.length} className="px-3 py-4 space-y-4">
                      {drillEventNames.map((eventName) => {
                        const contributions = g.contributionsByEvent[eventName] ?? [];
                        return (
                          <div key={eventName} className="rounded-md bg-white border border-ink/10 px-3 py-3">
                            <div className="flex items-baseline justify-between gap-3 mb-1">
                              <div className="text-[11px] uppercase tracking-wider text-ink/50 font-semibold">
                                {eventName}
                              </div>
                              <div className="font-data font-bold text-ink text-sm">
                                {g.pointsByEvent[eventName]} pts
                              </div>
                            </div>
                            {contributions.length === 0 ? (
                              <p className="text-xs text-ink/50 italic">
                                No per-finish detail recorded.
                              </p>
                            ) : (
                              <div>
                                {contributions.map((c, idx) => (
                                  <ContributionLine key={idx} c={c} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
