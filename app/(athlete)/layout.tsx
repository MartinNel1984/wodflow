import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AthleteRouteGuard from "@/components/AthleteRouteGuard";
import AthleteNav from "@/components/AthleteNav";

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/athlete-login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "athlete";

  return (
    <div className="min-h-screen bg-paper">
      <AthleteRouteGuard role={role} />
      <AthleteNav />
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
