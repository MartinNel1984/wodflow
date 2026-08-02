import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendTicketConfirmationEmail } from "@/lib/email";

// TEMPORARY — one-off manual verification that the ticket confirmation
// email actually sends from the deployed Worker (Cloudflare's send_email
// binding doesn't work in `next dev`, only in production). Guarded by
// the existing PIN_LOGIN_SECRET so it isn't a wide-open endpoint even
// briefly. Delete this route once the test send is confirmed.
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

  const supabase = createServiceClient();
  const { data: ticket, error } = await supabase
    .from("event_tickets")
    .insert({
      event_id: "79a44b2c-8ad7-474a-aad7-bd7c0835372a",
      ticket_type: "spectator",
      buyer_name: "Test Buyer",
      buyer_email: buyerEmail,
      quantity: 1,
      unit_price: 70,
      price_paid: 70,
      payment_status: "paid",
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !ticket) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }

  try {
    await sendTicketConfirmationEmail(ticket.id);
  } catch (err) {
    return NextResponse.json({ error: String(err), ticketId: ticket.id }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id, qrToken: ticket.qr_token });
}
