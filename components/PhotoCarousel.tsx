"use client";

import { useEffect, useRef } from "react";
import type { HubPhoto } from "@/lib/rumbleHub";

// Auto-advances the "From the Floor" strip so it reads as a living
// photo reel instead of a scroll list nobody thinks to swipe. Pauses
// while the visitor is actually touching/dragging it (so it never
// fights a manual swipe) and does nothing at all under
// prefers-reduced-motion, matching the rest of the site's motion rules.
export function PhotoCarousel({ photos }: { photos: HubPhoto[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const interval = setInterval(() => {
      if (pausedRef.current) return;
      const card = scroller.firstElementChild as HTMLElement | null;
      if (!card) return;
      const step = card.offsetWidth + 12; // gap-3 = 0.75rem = 12px
      const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
      scroller.scrollTo({ left: atEnd ? 0 : scroller.scrollLeft + step, behavior: "smooth" });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={scrollerRef}
      onPointerDown={() => (pausedRef.current = true)}
      onPointerUp={() => (pausedRef.current = false)}
      onPointerLeave={() => (pausedRef.current = false)}
      className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
    >
      {photos.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.id}
          src={p.image_url}
          alt={p.caption ?? ""}
          className="h-56 w-auto rounded-xl object-cover snap-center shrink-0"
          loading={i < 2 ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </div>
  );
}
