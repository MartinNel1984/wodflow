import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public, unauthenticated lookup keyed by the unguessable qr_token —
// same token-as-credential pattern as /api/invites/[token]. Uses the
// service client because the buyer has no session and event_tickets
// has no anon RLS policy (see migration-044's rationale).
export async function GET(_request: Request, { params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const supabase = createServiceClient();

  const { data: ticket, error } = await supabase
    .from("event_tickets")
    .select(
      "id, ticket_type, buyer_name, quantity, payment_status, checked_in_count, events(name, start_date, venue_name)"
    )
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (error) {
    console.error("Ticket lookup failed", error);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events;

  return NextResponse.json({
    ticketType: ticket.ticket_type,
    buyerName: ticket.buyer_name,
    quantity: ticket.quantity,
    paymentStatus: ticket.payment_status,
    checkedInCount: ticket.checked_in_count,
    eventName: event?.name ?? null,
    eventStartDate: event?.start_date ?? null,
    eventVenueName: event?.venue_name ?? null,
  });
}
