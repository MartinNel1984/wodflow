"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

// Minimal top bar for head_judge — the (judge) layout previously rendered
// nothing above the page body, so a head judge on /score had no way to
// jump to the gate check-in scanner without a raw link (Tjokkie,
// 2026-10-03). Only two destinations they need: scoring and check-in.
const links = [
  { href: "/score", label: "Score Entry" },
  { href: "/checkin", label: "Check-in" },
];

export default function HeadJudgeNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/judge-login");
  }

  return (
    <nav className="flex items-center justify-between border-b border-ink/10 px-4 sm:px-6 py-4 mb-4">
      <div className="text-lg font-semibold">
        <Logo />
      </div>
      <div className="flex items-center gap-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-semibold ${
              pathname.startsWith(link.href) ? "text-accent" : "text-ink/60 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        ))}
        <button onClick={signOut} className="text-sm text-ink/60 hover:text-ink">
          Sign out
        </button>
      </div>
    </nav>
  );
}
