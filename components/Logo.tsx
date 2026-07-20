// The Wodflow wordmark: "WODFLOW" in the display font, with the first
// "O" replaced by a barbell-plate glyph (thick orange disc + a paper-
// colored bar cutting through it, sleeve ends overhanging the disc).
// Only one O is replaced — swapping both would read as two random
// circles instead of one deliberate mark.
export function PlateGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="42" fill="var(--color-accent)" />
      <rect x="0" y="41" width="100" height="18" fill="var(--color-paper)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap ${className ?? ""}`}>
      <span>W</span>
      <PlateGlyph className="inline-block h-[0.72em] w-[0.72em] translate-y-[0.05em] mx-[0.02em]" />
      <span>DFLOW</span>
    </span>
  );
}
