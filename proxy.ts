import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public leaderboard/heat-sheet pages are read by everyone at a comp,
// re-hit on manual refresh, but a few seconds of staleness is fine —
// caching here keeps a crowd of viewers from turning into a crowd of
// live Supabase queries.
const CACHEABLE_PREFIXES = ["/leaderboard/", "/heats/"];

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (CACHEABLE_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=8, stale-while-revalidate=30"
    );
  }

  return response;
}

export const config = {
  matcher: ["/leaderboard/:path*", "/heats/:path*"],
};
