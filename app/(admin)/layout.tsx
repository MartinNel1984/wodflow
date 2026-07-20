import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminRouteGuard from "@/components/AdminRouteGuard";
import AdminNav from "@/components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role ?? "athlete";

  return (
    <div className="min-h-screen bg-paper">
      <AdminRouteGuard role={role} />
      <AdminNav />
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
