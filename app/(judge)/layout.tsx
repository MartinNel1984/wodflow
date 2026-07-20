import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import JudgeRouteGuard from "@/components/JudgeRouteGuard";

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
  // screen is never server-rendered to a non-judge.
  if (role !== "judge" && role !== "head_judge") redirect("/judge-login");

  return (
    <div className="min-h-screen bg-paper">
      <JudgeRouteGuard role={role} />
      <main className="p-4">{children}</main>
    </div>
  );
}
