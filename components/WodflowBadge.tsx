import { Logo } from "@/components/Logo";

// Site-wide footer credit. Rendered once in the root layout so every
// route gets it automatically, instead of each page copy-pasting its
// own (which is how it went missing/inconsistent across pages before).
// The whole badge is one link, not just the caption text under it.
export function WodflowBadge() {
  return (
    <a
      href="https://drafttwo.co.za"
      target="_blank"
      rel="noopener noreferrer"
      className="block text-center text-xs opacity-50 hover:opacity-80 transition-opacity py-6 no-underline text-inherit"
    >
      <div className="text-base font-semibold"><Logo /></div>
      <p className="mt-1">Infrastructure managed by Wodflow</p>
    </a>
  );
}
