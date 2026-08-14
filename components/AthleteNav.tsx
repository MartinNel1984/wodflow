"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const NOTICES_SEEN_KEY = "wodflow_notices_seen_at";

// localStorage never changes from outside this tab in a way we care about,
// so there's nothing to subscribe to — reads happen fresh on every render.
function subscribe() {
  return () => {};
}

export default function AthleteNav({
  currentDivisionId,
  latestNoticeAt,
  showPbsTab,
}: {
  currentDivisionId: string | null;
  latestNoticeAt: string | null;
  showPbsTab: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const hasUnreadNotice = useSyncExternalStore(
    subscribe,
    () => {
      if (!latestNoticeAt) return false;
      const seenAt = window.localStorage.getItem(NOTICES_SEEN_KEY);
      return !seenAt || new Date(latestNoticeAt) > new Date(seenAt);
    },
    () => false
  );

  useEffect(() => {
    if (!pathname.startsWith("/notice-board") || !latestNoticeAt) return;
    window.localStorage.setItem(NOTICES_SEEN_KEY, latestNoticeAt);
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
    ...(showPbsTab ? [{ href: "/pbs", label: "PBs" }] : []),
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
