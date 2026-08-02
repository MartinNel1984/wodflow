import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// TEMPORARY — one-off manual verification of the raw send_email binding
// (bypassing sendTicketConfirmationEmail's internal .catch(), which
// swallows send errors so the caller never sees them). Guarded by
// PIN_LOGIN_SECRET. Delete this route once the test is confirmed.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = request.headers.get("x-test-secret");
  if (!secret || secret !== process.env.PIN_LOGIN_SECRET) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const buyerEmail = (body?.buyerEmail as string | undefined)?.trim();
  if (!buyerEmail) {
    return NextResponse.json({ error: "buyerEmail required" }, { status: 400 });
  }

  let env;
  try {
    ({ env } = getCloudflareContext());
  } catch (err) {
    return NextResponse.json({ error: "getCloudflareContext failed: " + String(err) }, { status: 500 });
  }

  try {
    const result = await env.EMAIL.send({
      to: buyerEmail,
      from: { email: "noreply@wodflow.co.za", name: "Wodflow" },
      subject: "Wodflow test email — please ignore",
      html: "<p>This is a one-off delivery test.</p>",
      text: "This is a one-off delivery test.",
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), name: (err as Error)?.name, stack: (err as Error)?.stack }, { status: 500 });
  }
}
