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
    <div className="graffiti-page min-h-screen">
      <div className="graffiti-photos" aria-hidden="true">
        {/* eslint-disable @next/next/no-img-element */}
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <img key={n} src={`/mural/action-${n}.jpg`} alt="" />
        ))}
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      <div className="graffiti-hex" aria-hidden="true" />
      <AthleteRouteGuard role={role} />
      <AthleteNav />
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
