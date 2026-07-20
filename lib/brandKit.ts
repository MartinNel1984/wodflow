import type { CSSProperties } from "react";

export type BrandKit = {
  id: string;
  name: string;
  logo_url: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  color_accent: string | null;
  tagline: string | null;
};

// Only --color-accent is overridden — ink/paper stay Wodflow's own
// base for legibility, matching the anti-AI design system's approach
// (buttons/highlights carry the event's identity, not a full reskin
// that could wreck contrast on a kit with a light primary color).
export function brandKitStyle(kit: Pick<BrandKit, "color_primary"> | null | undefined): CSSProperties {
  if (!kit?.color_primary) return {};
  return { "--color-accent": kit.color_primary } as CSSProperties;
}
