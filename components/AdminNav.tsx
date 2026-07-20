"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/athletes", label: "Athletes" },
  { href: "/series", label: "Series" },
  { href: "/brand-kits", label: "Brand Kits" },
  { href: "/judges", label: "Judges" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <nav className="flex items-center justify-between border-b border-ink/10 px-4 sm:px-6 lg:px-8 py-4 mb-4">
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
