"use client";

import { useEffect, useState } from "react";

type Row = { name: string; total: number };

const PAGE_SIZE = 10;
const PAGE_INTERVAL_MS = 8000;

export default function DisplayView({
  seriesName,
  seriesYear,
  male,
  female,
}: {
  seriesName: string;
  seriesYear: number;
  male: Row[];
  female: Row[];
}) {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [pageIndex, setPageIndex] = useState(0);
  const [prevGender, setPrevGender] = useState(gender);
  if (prevGender !== gender) {
    setPrevGender(gender);
    setPageIndex(0);
  }

  const rows = gender === "male" ? male : female;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    const id = setInterval(() => {
      setPageIndex((prev) => {
        const next = prev + 1;
        if (next >= pageCount) {
          setGender((g) => (g === "male" ? "female" : "male"));
          return 0;
        }
        return next;
      });
    }, PAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pageCount]);

  const start = pageIndex * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  return (
    <div className="fixed inset-0 bg-ink text-paper flex flex-col overflow-hidden">
      <header className="px-10 pt-8 pb-6 flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-paper/50">Rumble Series</p>
          <h1 className="text-5xl md:text-7xl font-bold leading-none mt-2">
            {seriesName} <span className="text-accent">{seriesYear}</span>
          </h1>
          <p className="text-xl md:text-2xl text-paper/70 mt-3">
            {gender === "male" ? "Men" : "Women"} · Top {Math.min(rows.length, PAGE_SIZE * pageCount)}
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
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-2xl text-paper/50">
            No scored results yet.
          </div>
        ) : (
          <div className="h-full flex flex-col justify-between gap-2">
            {slice.map((r, i) => {
              const rank = start + i + 1;
              return (
                <div
                  key={`${r.name}-${rank}`}
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
                    <span className="text-3xl md:text-4xl font-semibold truncate">{r.name}</span>
                  </div>
                  <span className="text-4xl md:text-5xl font-bold tabular-nums text-accent shrink-0">
                    {r.total}
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
