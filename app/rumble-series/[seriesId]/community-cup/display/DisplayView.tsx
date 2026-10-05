"use client";

import { useEffect, useState } from "react";

type Gym = { gymName: string; totalPoints: number; distinctAthleteCount: number };

const PAGE_SIZE = 10;
const PAGE_INTERVAL_MS = 8000;

export default function DisplayView({
  seriesName,
  seriesYear,
  gyms,
  minAthletes,
}: {
  seriesName: string;
  seriesYear: number;
  gyms: Gym[];
  minAthletes: number;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const pageCount = Math.max(1, Math.ceil(gyms.length / PAGE_SIZE));

  useEffect(() => {
    if (pageCount <= 1) return;
    const id = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % pageCount);
    }, PAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pageCount]);

  const start = pageIndex * PAGE_SIZE;
  const slice = gyms.slice(start, start + PAGE_SIZE);

  return (
    <div className="fixed inset-0 bg-ink text-paper flex flex-col overflow-hidden">
      <header className="px-10 pt-8 pb-6 flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-paper/50">Community Cup</p>
          <h1 className="text-5xl md:text-7xl font-bold leading-none mt-2">
            {seriesName.replace(new RegExp(`\\s*${seriesYear}$`), "")}{" "}
            <span className="text-accent">{seriesYear}</span>
          </h1>
          <p className="text-xl md:text-2xl text-paper/70 mt-3">
            Gym leaderboard · {gyms.length} eligible (min {minAthletes} athletes)
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm uppercase tracking-[0.3em] text-paper/50">Page</p>
          <p className="text-3xl md:text-4xl font-bold text-accent">
            {pageIndex + 1}
            <span className="text-paper/40">/{pageCount}</span>
          </p>
        </div>
      </header>

      <main className="flex-1 px-10 pb-10 overflow-hidden">
        {gyms.length === 0 ? (
          <div className="h-full flex items-center justify-center text-2xl text-paper/50">
            No gyms meet the minimum athlete count yet.
          </div>
        ) : (
          <div className="h-full flex flex-col justify-between gap-2">
            {slice.map((g, i) => {
              const rank = start + i + 1;
              return (
                <div
                  key={`${g.gymName}-${rank}`}
                  className="flex items-center justify-between gap-6 px-8 py-4 rounded-2xl bg-paper/[0.04] border border-paper/10"
                >
                  <div className="flex items-center gap-6 min-w-0">
                    <span
                      className={`text-5xl md:text-6xl font-bold tabular-nums w-24 shrink-0 ${
                        rank <= 3 ? "text-accent" : "text-paper/80"
                      }`}
                    >
                      {rank}
                    </span>
                    <div className="min-w-0">
                      <div className="text-3xl md:text-4xl font-semibold truncate">{g.gymName}</div>
                      <div className="text-paper/50 text-sm md:text-base mt-1">
                        {g.distinctAthleteCount} athletes
                      </div>
                    </div>
                  </div>
                  <span className="text-4xl md:text-5xl font-bold tabular-nums text-accent shrink-0">
                    {g.totalPoints}
                  </span>
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, PAGE_SIZE - slice.length) }).map((_, i) => (
              <div key={`spacer-${i}`} className="py-4 opacity-0" aria-hidden />
            ))}
          </div>
        )}
      </main>

      <footer className="px-10 py-4 border-t border-paper/10 text-paper/50 text-sm uppercase tracking-[0.3em] flex items-center justify-between">
        <span>wodflow</span>
        <span>Live · auto-rotates every {PAGE_INTERVAL_MS / 1000}s</span>
      </footer>
    </div>
  );
}
