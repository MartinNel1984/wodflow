import { BackLink, BackHistoryLink } from "@/components/BackLink";

// Full-bright Rumble hero treatment, reused across athlete auth/portal
// pages and any page for an event branded with a Rumble kit — same
// dark backdrop + photo collage + crown/XX texture + glowing logo as
// the wodflow.co.za hub, so the identity stays consistent wherever a
// visitor lands, not just on the landing page itself.
//
// backHref/backLabel are opt-in (not every page using this backdrop
// should offer one — e.g. register confirmation shouldn't invite
// backing out of a completed registration). Pages reachable from
// several different parents should set useHistoryBack instead, so
// the button returns to wherever the visitor actually came from
// rather than always landing on backHref.
export function RumbleBackdrop({
  logoSrc,
  logoAlt,
  backHref,
  backLabel,
  useHistoryBack,
  children,
}: {
  logoSrc: string;
  logoAlt: string;
  backHref?: string;
  backLabel?: string;
  useHistoryBack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rumble-page min-h-screen">
      {backHref && useHistoryBack && <BackHistoryLink fallbackHref={backHref} label={backLabel} />}
      {backHref && !useHistoryBack && <BackLink href={backHref} label={backLabel} />}
      <div className="rumble-texture" aria-hidden="true" />
      <div
        className="relative z-10 flex flex-col items-center px-4 py-10"
        style={{ "--color-accent": "var(--rumble-blue-bright)" } as React.CSSProperties}
      >
        {/* mb-12, not mb-6: the logo's drop-shadow glow (45px blur) was
            bleeding onto the white content card immediately below it,
            reading as a translucent box sitting "behind" the logo
            (Nic, 08-03) — needs more clearance than the blur radius. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt={logoAlt} className="rumble-hero-logo-sm mb-12" />
        {children}
      </div>
    </div>
  );
}
