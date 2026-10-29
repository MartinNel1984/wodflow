import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// wodflow.co.za and rumbleinrandburg.co.za are served by this one Worker (see
// wrangler.jsonc). Each address is its own canonical host: www redirects to
// the apex, and every page response carries a Link: rel="canonical" header
// for the host it was requested on, so Google never sees www and apex (or
// http) as separate copies. Kept as edge middleware.ts: OpenNext on Workers
// can't deploy the Node-runtime proxy.ts, and next.config redirects() don't
// substitute :path* on Workers.
export const config = {
  runtime: "experimental-edge",
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};

const APEX_HOSTS = new Set(["wodflow.co.za", "rumbleinrandburg.co.za"]);

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const url = new URL(request.url);

  if (host.startsWith("www.") && APEX_HOSTS.has(host.slice(4))) {
    url.protocol = "https:";
    url.host = host.slice(4);
    return NextResponse.redirect(url, 308);
  }

  const res = NextResponse.next();
  if (APEX_HOSTS.has(host)) {
    const path = url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
    res.headers.set("Link", `<https://${host}${path}>; rel="canonical"`);
  }
  return res;
}
