"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function AthleteNav({ currentDivisionId }: { currentDivisionId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/athlete-login");
  }

  const links = [
    { href: currentDivisionId ? `/leaderboard/${currentDivisionId}` : null, label: "Leaderboard" },
    { href: currentDivisionId ? `/heats/${currentDivisionId}` : null, label: "Heats" },
    { href: "/notice-board", label: "Notice Board" },
    { href: "/photos", label: "Photos" },
  ];

  return (
    <nav className="relative flex flex-col gap-3 border-b border-paper/10 px-4 sm:px-6 lg:px-8 py-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">
          <Logo />
        </div>
        <button onClick={signOut} className="text-sm text-paper/60 hover:text-paper">
          Sign out
        </button>
      </div>
      <div className="flex items-center gap-5 overflow-x-auto">
        {links.map((link) =>
          link.href ? (
            <Link
              key={link.label}
              href={link.href}
              className={`text-sm font-semibold whitespace-nowrap ${
                pathname.startsWith(link.href) ? "text-paper" : "text-paper/50 hover:text-paper/80"
              }`}
            >
              {link.label}
            </Link>
          ) : (
            <span key={link.label} className="text-sm font-semibold whitespace-nowrap text-paper/30">
              {link.label}
            </span>
          )
        )}
      </div>
    </nav>
  );
}
