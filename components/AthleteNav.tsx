"use client";

import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function AthleteNav() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/athlete-login");
  }

  return (
    <nav className="flex items-center justify-between border-b border-ink/10 px-4 sm:px-6 lg:px-8 py-4 mb-4">
      <div className="text-lg font-semibold">
        <Logo />
      </div>
      <button onClick={signOut} className="text-sm text-ink/60 hover:text-ink">
        Sign out
      </button>
    </nav>
  );
}
