"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NOTICES_SEEN_KEY = "wodflow_notices_seen_at";

export default function AthleteNav({
  currentDivisionId,
  latestNoticeAt,
}: {
  currentDivisionId: string | null;
  latestNoticeAt: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasUnreadNotice, setHasUnreadNotice] = useState(false);

  useEffect(() => {
    if (!latestNoticeAt) return;
    const seenAt = window.localStorage.getItem(NOTICES_SEEN_KEY);
    setHasUnreadNotice(!seenAt || new Date(latestNoticeAt) > new Date(seenAt));
  }, [latestNoticeAt]);

  useEffect(() => {
    if (!pathname.startsWith("/notice-board") || !latestNoticeAt) return;
    window.localStorage.setItem(NOTICES_SEEN_KEY, latestNoticeAt);
    setHasUnreadNotice(false);
  }, [pathname, latestNoticeAt]);

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/athlete-login");
  }

  const links = [
    { href: "/portal", label: "My Wodflow" },
    // Routes to the picker page, which redirects straight through to
    // the single division when the athlete only has one registration
    // (same fast path the direct link used to be).
    { href: currentDivisionId ? `/leaderboard` : null, label: "Leaderboard" },
    { href: currentDivisionId ? `/heats/${currentDivisionId}` : null, label: "Heats" },
    { href: "/notice-board", label: "Notice Board" },
    { href: "/photos", label: "Photos" },
  ];

  return (
    <nav className="relative flex flex-col gap-3 border-b border-paper/10 px-4 sm:px-6 lg:px-8 py-4 mb-4">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="leading-tight">
          <p className="text-lg sm:text-xl font-bold uppercase tracking-wide text-paper">Rumble Series</p>
          <p className="text-xs uppercase tracking-widest text-paper/50">Athlete Portal</p>
        </Link>
        <button onClick={signOut} className="text-sm text-paper/60 hover:text-paper">
          Sign out
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {links.map((link) =>
          link.href ? (
            <Link
              key={link.label}
              href={link.href}
              className={`relative text-sm sm:text-lg font-bold whitespace-nowrap rounded-full px-3 sm:px-4 py-1.5 sm:py-2 transition-colors ${
                pathname.startsWith(link.href)
                  ? "bg-accent text-white"
                  : "text-paper/70 hover:text-paper hover:bg-paper/10"
              }`}
            >
              {link.label}
              {link.label === "Notice Board" && hasUnreadNotice && (
                <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500" aria-label="Unread notice" />
              )}
            </Link>
          ) : (
            <span
              key={link.label}
              className="text-sm sm:text-lg font-bold whitespace-nowrap rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-paper/30"
            >
              {link.label}
            </span>
          )
        )}
      </div>
    </nav>
  );
}
