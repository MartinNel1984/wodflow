import { NextRequest, NextResponse } from "next/server";
import { sendRegistrationEmails } from "@/lib/email";

// TEMPORARY diagnostic route — resend confirmation emails for a single
// known registration (Pair Pressure, 2026-08-13 support request).
// Remove immediately after use, do not leave in the codebase.
const SECRET = "pp-resend-6f2a9c";
const REGISTRATION_ID = "68d52b89-61ab-44ac-ad68-bbdc8facde5f";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await sendRegistrationEmails(REGISTRATION_ID);
  return NextResponse.json({ sent: true });
}
