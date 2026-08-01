import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createServiceClient } from "@/lib/supabase/service";

// Narrow local type for the send_email binding — deliberately not pulling
// in the full `wrangler types` output, which redefines global Request/
// Response (Response.json() -> Promise<unknown>) and breaks every existing
// route handler's `await request.json()` call project-wide.
interface SendEmailBinding {
  send(message: {
    to: string | string[];
    from: { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ messageId?: string }>;
}

declare global {
  interface CloudflareEnv {
    EMAIL: SendEmailBinding;
  }
}

const FROM = { email: "noreply@wodflow.co.za", name: "Wodflow" };

// Fired once a registration is confirmed paid (from the PayFast
// webhook, not at registration creation — a checkout can be abandoned).
// Sends the athlete a confirmation and the organizer a notification, to
// events.contact_email (already the field organizers fill in on event
// setup, e.g. Tjokkie's info@atgfitness.co.za) rather than a hardcoded
// address, so this works for any future organizer too.
export async function sendRegistrationEmails(registrationId: string) {
  const supabase = createServiceClient();

  const { data: registration } = await supabase
    .from("registrations")
    .select("id, team_name, price_paid, divisions(name), events(name, contact_email)")
    .eq("id", registrationId)
    .single();
  if (!registration) return;

  const { data: athletes } = await supabase
    .from("registration_athletes")
    .select("full_name, email, is_captain")
    .eq("registration_id", registrationId);

  const division = Array.isArray(registration.divisions) ? registration.divisions[0] : registration.divisions;
  const event = Array.isArray(registration.events) ? registration.events[0] : registration.events;
  const label = registration.team_name ?? athletes?.find((a) => a.is_captain)?.full_name ?? "An athlete";

  let env;
  try {
    ({ env } = getCloudflareContext());
  } catch (err) {
    console.error("sendRegistrationEmails: could not get Cloudflare context", err);
    return;
  }

  const sends: Promise<unknown>[] = [];

  for (const athlete of athletes ?? []) {
    if (!athlete.email) continue;
    const firstName = athlete.full_name.split(" ")[0];
    sends.push(
      env.EMAIL.send({
        to: athlete.email,
        from: FROM,
        subject: `You're registered — ${event?.name ?? "Wodflow"}`,
        html: `<p>Hi ${firstName},</p><p>You're confirmed for <strong>${division?.name}</strong> at <strong>${event?.name}</strong>. R${registration.price_paid} paid.</p><p>Your heat time and lane will be published closer to the event.</p>`,
        text: `Hi ${firstName}, you're confirmed for ${division?.name} at ${event?.name}. R${registration.price_paid} paid. Your heat time and lane will be published closer to the event.`,
      }).catch((err) => console.error("Athlete confirmation email failed", athlete.email, err))
    );
  }

  if (event?.contact_email) {
    sends.push(
      env.EMAIL.send({
        to: event.contact_email,
        from: FROM,
        subject: `New registration — ${label} (${division?.name ?? "division"})`,
        html: `<p>${label} just registered and paid for <strong>${division?.name}</strong> at <strong>${event?.name}</strong>.</p><p>R${registration.price_paid} paid.</p>`,
        text: `${label} just registered and paid for ${division?.name} at ${event?.name}. R${registration.price_paid} paid.`,
      }).catch((err) => console.error("Organizer notification email failed", err))
    );
  }

  await Promise.all(sends);
}

// Fired once a ticket purchase is confirmed paid (from the PayFast
// webhook, not at ticket-row creation — same timing as
// sendRegistrationEmails, and for the same reason: a checkout can be
// abandoned). Links to the ticket page rather than embedding the QR
// inline, since SVG/canvas renders unreliably across email clients —
// the QR itself is rendered client-side on /tickets/[qr_token].
export async function sendTicketConfirmationEmail(ticketId: string) {
  const supabase = createServiceClient();

  const { data: ticket } = await supabase
    .from("event_tickets")
    .select("id, buyer_name, buyer_email, ticket_type, quantity, price_paid, qr_token, events(name, contact_email)")
    .eq("id", ticketId)
    .single();
  if (!ticket) return;

  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events;
  const firstName = ticket.buyer_name.split(" ")[0];
  const typeLabel = ticket.ticket_type === "vendor" ? "Vendor pass" : "Spectator pass";

  let env;
  try {
    ({ env } = getCloudflareContext());
  } catch (err) {
    console.error("sendTicketConfirmationEmail: could not get Cloudflare context", err);
    return;
  }

  // Matches the hardcoded SITE_URL pattern already used in
  // app/platform/control/page.tsx — no NEXT_PUBLIC_SITE_URL env var
  // exists in this project to read instead.
  const ticketUrl = `https://wodflow.co.za/tickets/${ticket.qr_token}`;

  const sends: Promise<unknown>[] = [];

  if (ticket.buyer_email) {
    sends.push(
      env.EMAIL.send({
        to: ticket.buyer_email,
        from: FROM,
        subject: `Your ${typeLabel.toLowerCase()} — ${event?.name ?? "Wodflow"}`,
        html: `<p>Hi ${firstName},</p><p>Your <strong>${typeLabel}</strong> (×${ticket.quantity}) for <strong>${event?.name}</strong> is confirmed. R${ticket.price_paid} paid.</p><p><a href="${ticketUrl}">View your ticket and QR code</a> — show this at the gate to check in.</p>`,
        text: `Hi ${firstName}, your ${typeLabel.toLowerCase()} (x${ticket.quantity}) for ${event?.name} is confirmed. R${ticket.price_paid} paid. View your ticket and QR code: ${ticketUrl} — show this at the gate to check in.`,
      }).catch((err) => console.error("Ticket buyer confirmation email failed", ticket.buyer_email, err))
    );
  }

  if (event?.contact_email) {
    sends.push(
      env.EMAIL.send({
        to: event.contact_email,
        from: FROM,
        subject: `New ${typeLabel.toLowerCase()} sale — ${ticket.buyer_name} (×${ticket.quantity})`,
        html: `<p>${ticket.buyer_name} just bought a <strong>${typeLabel}</strong> (×${ticket.quantity}) for <strong>${event?.name}</strong>.</p><p>R${ticket.price_paid} paid.</p>`,
        text: `${ticket.buyer_name} just bought a ${typeLabel.toLowerCase()} (x${ticket.quantity}) for ${event?.name}. R${ticket.price_paid} paid.`,
      }).catch((err) => console.error("Organizer ticket notification email failed", err))
    );
  }

  await Promise.all(sends);
}
