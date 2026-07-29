// Full-bright Rumble hero treatment, reused across athlete auth/portal
// pages and any page for an event branded with a Rumble kit — same
// dark backdrop + photo collage + crown/XX texture + glowing logo as
// the wodflow.co.za hub, so the identity stays consistent wherever a
// visitor lands, not just on the landing page itself.
export function RumbleBackdrop({
  logoSrc,
  logoAlt,
  children,
}: {
  logoSrc: string;
  logoAlt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rumble-page min-h-screen">
      <div className="rumble-photos" aria-hidden="true">
        {/* eslint-disable @next/next/no-img-element */}
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <img key={n} src={`/mural/action-${n}.jpg`} alt="" />
        ))}
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      <div className="rumble-texture" aria-hidden="true" />
      <div
        className="relative z-10 flex flex-col items-center px-4 py-10"
        style={{ "--color-accent": "var(--rumble-blue-bright)" } as React.CSSProperties}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt={logoAlt} className="rumble-hero-logo-sm mb-6" />
        {children}
      </div>
    </div>
  );
}
