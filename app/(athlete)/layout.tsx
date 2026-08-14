import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AthleteRouteGuard from "@/components/AthleteRouteGuard";
import AthleteNav from "@/components/AthleteNav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/athlete-login");

  const { data: profile } = await supabase.from("profiles").select("role, gym_name").eq("id", user.id).single();
  const role = profile?.role ?? "athlete";
  // Fuzzy free-text match, mirrors public.is_atg_athlete() (migration-070)
  // — gates the PBs nav tab. The /pbs route re-checks server-side too.
  const gymName = (profile?.gym_name ?? "").toLowerCase();
  const isAtgAthlete = gymName.includes("atg") || gymName.includes("against the grain");

  // Enforce the role server-side (matches AthleteRouteGuard) so the portal
  // is never server-rendered to a non-athlete.
  if (role !== "athlete") redirect("/athlete-login");

  // Leaderboard/Heats nav tabs link straight to the athlete's most
  // recent registration — no picker, since almost everyone only has
  // one active registration at a time (Martin's call).
  const { data: myRegs } = await supabase
    .from("registration_athletes")
    .select("registrations(division_id, created_at)")
    .eq("profile_id", user.id);
  const currentDivisionId =
    (myRegs ?? [])
      .map((r) => (Array.isArray(r.registrations) ? r.registrations[0] : r.registrations))
      .filter((r): r is { division_id: string; created_at: string } => !!r)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.division_id ?? null;

  // RLS (migration-056) already limits this to notices for events the
  // athlete is registered in — used to flag unread notices in the nav.
  const { data: latestNotice } = await supabase
    .from("notices")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="rumble-page min-h-screen" style={{ "--color-accent": "var(--rumble-blue-bright)" } as React.CSSProperties}>
      <div className="rumble-texture" aria-hidden="true" />
      <AthleteRouteGuard role={role} />
      <AthleteNav
        currentDivisionId={currentDivisionId}
        latestNoticeAt={latestNotice?.created_at ?? null}
        showPbsTab={isAtgAthlete}
      />
      {/* Hero logo moved into each page (AthleteHeroLogo) instead of living
          here — the portal home page needs its profile/rank blocks visible
          without scrolling, so it renders the logo lower down the page
          instead of above the fold. Notice Board/Photos keep the old
          top-of-page placement. */}
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
