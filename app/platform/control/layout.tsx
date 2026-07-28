import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Unlisted platform-owner console — not linked from any nav. The URL
// segment being unguessable is a nicety; the real gate is the
// server-side role check below plus RLS (platform_admin bypasses
// organization scoping everywhere else, see migration-026).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "platform_admin") redirect("/login");

  return (
    <div className="min-h-screen bg-ink text-paper">
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
