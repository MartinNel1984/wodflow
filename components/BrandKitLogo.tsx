import { Logo } from "@/components/Logo";
import type { BrandKit } from "@/lib/brandKit";

// Falls back to Wodflow's own wordmark when an event has no brand kit
// (or the kit has no logo uploaded yet) — every event page must always
// show a real mark, never a blank space.
export function BrandKitLogo({
  kit,
  className,
}: {
  kit: Pick<BrandKit, "name" | "logo_url"> | null | undefined;
  className?: string;
}) {
  if (kit?.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={kit.logo_url} alt={kit.name} className={className ?? "h-10 mx-auto"} />;
  }
  return (
    <span className={className}>
      <Logo />
    </span>
  );
}
