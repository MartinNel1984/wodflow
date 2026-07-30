"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const Icon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

// Fixed top-left back button for pages one hop from a landing page
// (hub, all-events) — inherits --color-accent from whichever theme
// wraps it (rumble blue vs wodflow flame-orange), so it never needs
// its own color prop.
export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="back-link">
      <Icon />
      <span>{label}</span>
    </Link>
  );
}

// Pages reachable from more than one parent (e.g. leaderboard: home,
// athlete portal, heats page) need real browser-history back instead
// of a single fixed href, else it always lands on `fallbackHref`
// regardless of where the visitor actually came from.
export function BackHistoryLink({ fallbackHref, label = "Back" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="back-link"
    >
      <Icon />
      <span>{label}</span>
    </button>
  );
}
