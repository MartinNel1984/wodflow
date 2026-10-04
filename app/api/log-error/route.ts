import { NextResponse } from "next/server";
import { logError } from "@/lib/log-error";

// In-app browsers (Instagram, Facebook, TikTok, etc.) inject their own
// bridge/analytics scripts and surface "Load failed" / network-bridge
// errors that look real but originate in the host app, not our code.
// Firefox for iOS (FxiOS) has stricter JS-parser quirks that throw on
// perfectly valid JS from third-party scripts; we see "No identifiers
// allowed directly after numeric literal" and "Non-number found after
// exponent indicator" only from FxiOS, never from Safari/Chrome.
function isNoisyBrowserError(userAgent: string | null, message: string): boolean {
  if (!userAgent) return false;
  if (/Instagram|FBAV|FBAN|FB_IAB|TikTok|Line\//i.test(userAgent)) return true;
  if (/FxiOS/.test(userAgent) && /SyntaxError: (No identifiers allowed directly after numeric literal|Non-number found after exponent indicator)/.test(message)) {
    return true;
  }
  return false;
}

// Public, unauthenticated on purpose — this is where client-side error
// boundaries/listeners report in from a browser that may not have a
// session (e.g. an error on the login page itself). The service-role
// key never leaves the server; logError() is the only thing that uses it.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  if (isNoisyBrowserError(userAgent, body.message)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await logError(body.message, {
    source: "client",
    route: typeof body.route === "string" ? body.route : undefined,
    stack: typeof body.stack === "string" ? body.stack : undefined,
    extra: { userAgent },
  });

  return NextResponse.json({ ok: true });
}
