"use client";

import { useState } from "react";

type Photo = { id: string; image_url: string; caption: string | null };
type Group = { eventName: string; dateKey: string; photos: Photo[] };

// Martin's feedback (2026-08-12): with 3,275+ photos across two events
// already, stacking every event's full grid on one page isn't
// browsable — athletes need to pick an event first, like the
// Leaderboard tab's picker.
export function PhotoEventPicker({ groups }: { groups: Group[] }) {
  const [selected, setSelected] = useState(0);
  const group = groups[selected];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {groups.map((g, i) => (
          <button
            key={g.eventName + g.dateKey}
            type="button"
            onClick={() => setSelected(i)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
              i === selected ? "bg-accent text-white" : "bg-white text-ink/70 border-2 border-ink"
            }`}
          >
            {g.eventName} <span className="opacity-60">({g.photos.length})</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {group.photos.map((p) => (
          <a
            key={p.id}
            href={`/api/photos/${p.id}/download`}
            className="block bg-white border-2 border-ink rounded-xl overflow-hidden hover-lift"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt={p.caption ?? ""} className="w-full aspect-square object-cover" />
            <p className="text-ink/70 text-xs text-center py-1.5 font-semibold">Download ↓</p>
          </a>
        ))}
      </div>
    </div>
  );
}
