"use client";

import { useEffect, useState } from "react";

type Photo = { id: string; image_url: string; caption: string | null };
type Group = { id: string; type: "event" | "historical"; eventName: string; dateKey: string; count: number };

const PAGE_SIZE = 60;

// Martin's feedback (2026-08-12): with 3,000+ photos across two events,
// loading everything upfront isn't usable — each event's photos now
// load only once its tab is picked, cached per tab so switching back
// and forth doesn't re-fetch. A single event can still be 2,000+
// photos, which is too many <img> tags to render in one grid on a
// phone, so the grid itself paginates in batches too. Tabs are also
// sized up per his request ("bigger and more prominent") since they're
// the primary nav here.
export function PhotoEventPicker({ groups }: { groups: Group[] }) {
  const [selected, setSelected] = useState(0);
  const [cache, setCache] = useState<Record<string, Photo[]>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const group = groups[selected];
  const key = `${group.type}:${group.id}`;

  useEffect(() => {
    if (cache[key]) return;
    fetch(`/api/photos/by-event?type=${group.type}&id=${group.id}`)
      .then((r) => r.json())
      .then((data) => setCache((prev) => ({ ...prev, [key]: data.photos ?? [] })));
  }, [key, group.type, group.id, cache]);

  function select(i: number) {
    setSelected(i);
    setVisibleCount(PAGE_SIZE);
  }

  const photos = cache[key];
  const visiblePhotos = photos?.slice(0, visibleCount);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {groups.map((g, i) => (
          <button
            key={g.type + g.id}
            type="button"
            onClick={() => select(i)}
            className={`rounded-2xl px-4 py-5 text-center font-bold transition-colors ${
              i === selected
                ? "bg-accent text-white shadow-lg"
                : "bg-white text-ink border-2 border-ink hover-lift"
            }`}
          >
            <p className="text-base leading-tight">{g.eventName}</p>
            <p className={`text-sm mt-1 font-semibold ${i === selected ? "text-white/80" : "text-ink/50"}`}>
              {g.count} photos
            </p>
          </button>
        ))}
      </div>

      {!photos && (
        <p className="text-paper/60 text-sm text-center py-10">Loading {group.eventName} photos…</p>
      )}

      {visiblePhotos && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visiblePhotos.map((p) => (
              <a
                key={p.id}
                href={`/api/photos/${p.id}/download`}
                className="block bg-white border-2 border-ink rounded-xl overflow-hidden hover-lift"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url}
                  alt={p.caption ?? ""}
                  loading="lazy"
                  className="w-full aspect-square object-cover"
                />
                <p className="text-ink/70 text-xs text-center py-1.5 font-semibold">Download ↓</p>
              </a>
            ))}
          </div>
          {photos && visibleCount < photos.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full bg-white border-2 border-ink rounded-xl py-3 text-sm font-semibold text-ink hover-lift"
            >
              Load more ({photos.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}
