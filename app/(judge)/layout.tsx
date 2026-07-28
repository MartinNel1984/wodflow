import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import JudgeRouteGuard from "@/components/JudgeRouteGuard";
import AdminNav from "@/components/AdminNav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function JudgeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/judge-login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role ?? "athlete";

  // Enforce the role server-side (matches JudgeRouteGuard) so the score
  // screen is never server-rendered to an unauthorized role. Organizer is
  // allowed too — /score already branches on organizer/head_judge to show
  // every heat for centralized score entry/correction (Milestone 12).
  if (role !== "judge" && role !== "head_judge" && role !== "organizer") redirect("/judge-login");

  return (
    <div className="min-h-screen bg-paper">
      <JudgeRouteGuard role={role} />
      {/* Organizers reaching /score from the admin side lost the top
          nav entirely here (this route group has no AdminNav) — no way
          back except the browser back button. Judges/head_judges don't
          need it, they only ever have this one screen. */}
      {role === "organizer" && <AdminNav />}
      <main className="p-4">{children}</main>
    </div>
  );
}
