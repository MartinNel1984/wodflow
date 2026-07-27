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
    <nav className="relative flex items-center justify-between border-b border-paper/10 px-4 sm:px-6 lg:px-8 py-4 mb-4">
      <div className="text-lg font-semibold">
        <Logo />
      </div>
      <button onClick={signOut} className="text-sm text-paper/60 hover:text-paper">
        Sign out
      </button>
    </nav>
  );
}
