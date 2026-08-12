export function AthleteHeroLogo({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <div className="flex justify-center pt-2 pb-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/rumble/series-logo-v2.png"
        alt="Rumble Series"
        className={size === "lg" ? "rumble-hero-logo" : "rumble-hero-logo-sm"}
      />
    </div>
  );
}
