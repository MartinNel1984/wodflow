"use client";

import { useState } from "react";
import type { SeriesStanding } from "@/lib/series";

// Left-to-right reading order Martin/Tjokkie want in the drill-down,
// oldest/earliest in the series first through to the newest — event
// names not in this list fall in alphabetically at the end rather than
// disappearing. Mirrors app/(admin)/series/[seriesId]/leaderboard EVENT_COLUMN_ORDER
// so the two tables agree on column order.
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

export default function LeaderboardView({
  seriesName,
  seriesYear,
  male,
  female,
  nameByProfile,
}: {
  seriesName: string;
  seriesYear: number;
  male: SeriesStanding[];
  female: SeriesStanding[];
  nameByProfile: Record<string, string>;
}) {
  const [tab, setTab] = useState<"male" | "female">("male");
  const standings = tab === "male" ? male : female;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-ink/60">Rumble Series</p>
        <h1 className="text-3xl sm:text-4xl font-semibold">{seriesName} {seriesYear}</h1>
        <p className="text-sm text-ink/70">
          Individual rankings across the series. Tap any athlete to see their per-event breakdown.
        </p>
      </header>

      <div className="inline-flex rounded-lg border border-ink/15 bg-white p-1 text-sm font-semibold">
        <button
          onClick={() => setTab("male")}
          className={`px-4 py-1.5 rounded-md transition ${tab === "male" ? "bg-accent text-white" : "text-ink/70 hover:text-ink"}`}
        >
          Men ({male.length})
        </button>
        <button
          onClick={() => setTab("female")}
          className={`px-4 py-1.5 rounded-md transition ${tab === "female" ? "bg-accent text-white" : "text-ink/70 hover:text-ink"}`}
        >
          Women ({female.length})
        </button>
      </div>

      <StandingsTable standings={standings} nameByProfile={nameByProfile} />
    </div>
  );
}

function StandingsTable({
  standings,
  nameByProfile,
}: {
  standings: SeriesStanding[];
  nameByProfile: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (standings.length === 0) {
    return (
      <div className="bg-white border border-ink/10 rounded-xl p-8 text-center text-ink/60">
        No scored results yet.
      </div>
    );
  }

  function toggle(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  return (
    <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ink/5 text-left text-xs uppercase tracking-wider text-ink/60">
            <th className="px-3 py-3 w-12">#</th>
            <th className="px-3 py-3">Athlete</th>
            <th className="px-3 py-3 text-right w-20">Total</th>
            <th className="px-2 py-3 w-6" aria-hidden></th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const isOpen = expanded === s.profileId;
            const name = nameByProfile[s.profileId] ?? s.displayName;
            const eventNames = orderEventNames(Object.keys(s.pointsByEvent));
            return (
              <RowGroup
                key={s.profileId}
                rank={i + 1}
                name={name}
                total={s.totalPoints}
                isOpen={isOpen}
                onToggle={() => toggle(s.profileId)}
                eventNames={eventNames}
                pointsByEvent={s.pointsByEvent}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowGroup({
  rank,
  name,
  total,
  isOpen,
  onToggle,
  eventNames,
  pointsByEvent,
}: {
  rank: number;
  name: string;
  total: number;
  isOpen: boolean;
  onToggle: () => void;
  eventNames: string[];
  pointsByEvent: Record<string, number>;
}) {
  return (
    <>
      <tr
        className={`border-t border-ink/10 cursor-pointer transition hover:bg-ink/5 ${isOpen ? "bg-ink/5" : ""}`}
        onClick={onToggle}
      >
        <td className="px-3 py-3 font-data font-bold text-accent">{rank}</td>
        <td className="px-3 py-3 truncate">{name}</td>
        <td className="px-3 py-3 text-right font-data font-bold">{total}</td>
        <td className="px-2 py-3 text-ink/40 text-xs">
          <span className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t border-ink/10 bg-ink/[0.02]">
          <td colSpan={4} className="px-3 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {eventNames.map((eventName) => (
                <div key={eventName} className="rounded-md bg-white border border-ink/10 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-ink/50 leading-tight">{eventName}</div>
                  <div className="font-data font-bold text-ink">{pointsByEvent[eventName]}</div>
                </div>
              ))}
              <div className="rounded-md bg-accent/10 border border-accent/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-accent leading-tight">Total</div>
                <div className="font-data font-bold text-accent">{total}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
