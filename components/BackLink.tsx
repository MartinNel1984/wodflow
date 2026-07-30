import Link from "next/link";

// Fixed top-left back button for pages one hop from a landing page
// (hub, all-events) — inherits --color-accent from whichever theme
// wraps it (rumble blue vs wodflow flame-orange), so it never needs
// its own color prop.
export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="back-link">
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
      <span>{label}</span>
    </Link>
  );
}
