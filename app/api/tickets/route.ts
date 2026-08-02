import { createServiceClient } from "@/lib/supabase/service";
import { createPayfastCheckout } from "@/lib/payfast";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Prefix distinguishes ticket payments from registration payments in the
// PayFast webhook's m_payment_id — see app/api/webhooks/payfast/route.ts.
const TICKET_ID_PREFIX = "ticket_";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const eventId = (body?.eventId as string | undefined)?.trim();
  const ticketType = body?.ticketType as string | undefined;
  const buyerName = (body?.buyerName as string | undefined)?.trim();
  const buyerEmail = (body?.buyerEmail as string | undefined)?.trim().toLowerCase();
  const quantity = Number(body?.quantity);

  if (!eventId || !buyerName || !buyerEmail || !buyerEmail.includes("@")) {
    return NextResponse.json({ error: "Missing required ticket fields." }, { status: 400 });
  }
  if (ticketType !== "spectator") {
    return NextResponse.json({ error: "Invalid ticket type." }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Quantity must be a whole number of at least 1." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, status, spectator_price, contact_email")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  // Ticket sales are only open once the organizer has published the
  // event — same rule /api/registrations enforces for registration.
  if (!["published", "live"].includes(event.status)) {
    return NextResponse.json({ error: "Tickets for this event aren't on sale." }, { status: 403 });
  }

  const unitPrice = event.spectator_price;
  // Blank price = spectator tickets are disabled for this event
  // (opt-in per event, no forced default — matches the design doc's
  // scope decision) rather than falling back to some default price.
  if (unitPrice == null) {
    return NextResponse.json({ error: "This ticket type isn't available for this event." }, { status: 400 });
  }

  const pricePaid = Number((unitPrice * quantity).toFixed(2));
  const typeLabel = "Spectator pass";

  const { data: ticket, error: insertError } = await supabase
    .from("event_tickets")
    .insert({
      event_id: event.id,
      ticket_type: ticketType,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      quantity,
      unit_price: unitPrice,
      price_paid: pricePaid,
    })
    .select("id, qr_token")
    .single();

  if (insertError || !ticket) {
    console.error("Could not create ticket", insertError);
    return NextResponse.json({ error: "Could not create ticket." }, { status: 500 });
  }

  const siteOrigin = new URL(request.url).origin;
  // Safe to send the buyer straight to the ticket page after payment —
  // qr_token exists from insert regardless of payment_status, and the
  // page itself shows "payment processing" instead of a QR until the
  // webhook has actually marked it paid.
  const ticketPageUrl = `${siteOrigin}/tickets/${ticket.qr_token}`;

  try {
    const { payUrl } = createPayfastCheckout({
      amountRands: pricePaid,
      id: `${TICKET_ID_PREFIX}${ticket.id}`,
      itemName: `${typeLabel} — ${event.name}`,
      buyerName,
      buyerEmail,
      siteOrigin,
      returnUrl: ticketPageUrl,
      cancelUrl: ticketPageUrl,
    });

    return NextResponse.json({ ticketId: ticket.id, qrToken: ticket.qr_token, payUrl });
  } catch (err) {
    console.error("Ticket checkout creation failed", err);
    return NextResponse.json(
      { error: "Ticket saved, but payment setup failed. Please contact the organizer." },
      { status: 502 }
    );
  }
}
