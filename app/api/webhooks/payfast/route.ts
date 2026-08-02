import { createServiceClient } from "@/lib/supabase/service";
import { verifyPayfastSignature, validatePayfastItn } from "@/lib/payfast-webhook";
import { sendRegistrationEmails, sendTicketConfirmationEmail } from "@/lib/email";

// Ticket purchases prefix their m_payment_id with "ticket_" so this
// webhook can tell which table a payment belongs to before looking it
// up — everything else (registrations) is unprefixed, matching every
// m_payment_id PayFast has ever been sent by this app pre-tickets.
const TICKET_ID_PREFIX = "ticket_";

// Both registrations and event_tickets key off a uuid primary key.
// Querying `.eq("id", "not-a-uuid")` doesn't return zero rows — Postgres
// raises 22P02 (invalid input syntax for type uuid), which the handlers
// below would otherwise surface as a 500, making PayFast retry a
// malformed ITN indefinitely. Shape-check first and ack instead.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // Must read the raw body before parsing — signature is computed over the
  // exact bytes PayFast sent, not our re-serialized form data.
  const rawBody = await request.text();

  if (!verifyPayfastSignature(rawBody)) {
    console.error("PayFast webhook: invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }

  const validated = await validatePayfastItn(rawBody);
  if (!validated) {
    console.error("PayFast webhook: ITN validate call rejected");
    return new Response("Not validated", { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const paymentStatus = params.get("payment_status");
  const paymentId = params.get("m_payment_id");
  const amountGross = params.get("amount_gross");
  const pfPaymentId = params.get("pf_payment_id");

  if (!paymentId) {
    return new Response("Missing m_payment_id", { status: 400 });
  }
  if (paymentStatus !== "COMPLETE") {
    // Ack anything we don't act on so PayFast stops retrying it.
    return new Response("OK", { status: 200 });
  }

  const isTicket = paymentId.startsWith(TICKET_ID_PREFIX);
  const recordId = isTicket ? paymentId.slice(TICKET_ID_PREFIX.length) : paymentId;

  if (!UUID_RE.test(recordId)) {
    console.error("PayFast webhook: m_payment_id is not a uuid", { paymentId });
    // Ack — this is not a payment we can ever match, so retrying is pointless.
    return new Response("OK", { status: 200 });
  }

  if (isTicket) {
    return handleTicketPayment(recordId, amountGross, pfPaymentId);
  }
  return handleRegistrationPayment(recordId, amountGross, pfPaymentId);
}

async function handleRegistrationPayment(
  registrationId: string,
  amountGross: string | null,
  pfPaymentId: string | null
) {
  const supabase = createServiceClient();
  const { data: registration, error: lookupError } = await supabase
    .from("registrations")
    .select("id, payment_status, price_paid")
    .eq("id", registrationId)
    .maybeSingle();

  if (lookupError) {
    console.error("PayFast webhook: registration lookup failed", lookupError);
    return new Response("Lookup failed", { status: 500 });
  }
  if (!registration) {
    // Nothing to do — ack so PayFast doesn't keep retrying a payment we
    // don't recognize.
    return new Response("OK", { status: 200 });
  }
  if (registration.payment_status === "paid") {
    // Already handled — PayFast retries ITN delivery, this must be a no-op.
    return new Response("OK", { status: 200 });
  }

  // Fail closed: an ITN with no amount_gross at all must not skip this
  // check silently — treat a missing field the same as a mismatch.
  const amountParsed = amountGross ? parseFloat(amountGross) : NaN;
  if (!Number.isFinite(amountParsed) || Math.abs(amountParsed - Number(registration.price_paid)) > 0.5) {
    console.error("PayFast webhook: amount mismatch or missing", {
      registrationId,
      amountGross,
      expected: registration.price_paid,
    });
    return new Response("Amount mismatch", { status: 400 });
  }

  // Scope the update to payment_status != "paid" and check what actually
  // changed, rather than trusting the read above — two concurrent ITN
  // deliveries can both pass that check before either commits, which
  // would otherwise send the confirmation email twice.
  const { data: updated, error: updateError } = await supabase
    .from("registrations")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      paid_via: "payfast",
      payfast_payment_id: pfPaymentId,
    })
    .eq("id", registrationId)
    .neq("payment_status", "paid")
    .select("id");

  if (updateError) {
    console.error("PayFast webhook: failed to mark registration paid", updateError);
    return new Response("Update failed", { status: 500 });
  }

  if (updated && updated.length > 0) {
    await sendRegistrationEmails(registrationId).catch((err) =>
      console.error("PayFast webhook: sendRegistrationEmails failed", err)
    );
  }

  return new Response("OK", { status: 200 });
}

async function handleTicketPayment(ticketId: string, amountGross: string | null, pfPaymentId: string | null) {
  const supabase = createServiceClient();
  const { data: ticket, error: lookupError } = await supabase
    .from("event_tickets")
    .select("id, payment_status, price_paid")
    .eq("id", ticketId)
    .maybeSingle();

  if (lookupError) {
    console.error("PayFast webhook: ticket lookup failed", lookupError);
    return new Response("Lookup failed", { status: 500 });
  }
  if (!ticket) {
    // Nothing to do — ack so PayFast doesn't keep retrying a payment we
    // don't recognize.
    return new Response("OK", { status: 200 });
  }
  if (ticket.payment_status === "paid") {
    // Already handled — PayFast retries ITN delivery, this must be a no-op.
    return new Response("OK", { status: 200 });
  }

  // Same fail-closed amount check as registrations.
  const amountParsed = amountGross ? parseFloat(amountGross) : NaN;
  if (!Number.isFinite(amountParsed) || Math.abs(amountParsed - Number(ticket.price_paid)) > 0.5) {
    console.error("PayFast webhook: ticket amount mismatch or missing", {
      ticketId,
      amountGross,
      expected: ticket.price_paid,
    });
    return new Response("Amount mismatch", { status: 400 });
  }

  // Same idempotent conditional update as registrations — two concurrent
  // ITN deliveries can both pass the check above before either commits,
  // which would otherwise send the confirmation email (with the ticket's
  // only QR link) twice.
  const { data: updated, error: updateError } = await supabase
    .from("event_tickets")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      payfast_payment_id: pfPaymentId,
    })
    .eq("id", ticketId)
    .neq("payment_status", "paid")
    .select("id");

  if (updateError) {
    console.error("PayFast webhook: failed to mark ticket paid", updateError);
    return new Response("Update failed", { status: 500 });
  }

  if (updated && updated.length > 0) {
    await sendTicketConfirmationEmail(ticketId).catch((err) =>
      console.error("PayFast webhook: sendTicketConfirmationEmail failed", err)
    );
  }

  return new Response("OK", { status: 200 });
}
