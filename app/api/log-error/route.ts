import { NextResponse } from "next/server";
import { logError } from "@/lib/log-error";

// Public, unauthenticated on purpose — this is where client-side error
// boundaries/listeners report in from a browser that may not have a
// session (e.g. an error on the login page itself). The service-role
// key never leaves the server; logError() is the only thing that uses it.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await logError(body.message, {
    source: "client",
    route: typeof body.route === "string" ? body.route : undefined,
    stack: typeof body.stack === "string" ? body.stack : undefined,
  });

  return NextResponse.json({ ok: true });
}
