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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "athlete";

  // Enforce the role server-side (matches AthleteRouteGuard) so the portal
  // is never server-rendered to a non-athlete.
  if (role !== "athlete") redirect("/athlete-login");

  return (
    <div className="rumble-page min-h-screen" style={{ "--color-accent": "var(--rumble-blue-bright)" } as React.CSSProperties}>
      <div className="rumble-texture" aria-hidden="true" />
      <AthleteRouteGuard role={role} />
      <AthleteNav />
      <div className="flex justify-center pt-2 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rumble/series-logo-v2.png" alt="Rumble Series" className="rumble-hero-logo-sm" />
      </div>
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
