import { createServiceClient } from "@/lib/supabase/service";
import { verifyYocoWebhookSignature } from "@/lib/yoco-webhook";

export async function POST(request: Request) {
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("YOCO_WEBHOOK_SECRET is not set — rejecting webhook");
    return new Response("Webhook not configured", { status: 500 });
  }

  const webhookId = request.headers.get("webhook-id");
  const webhookTimestamp = request.headers.get("webhook-timestamp");
  const webhookSignature = request.headers.get("webhook-signature");
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return new Response("Missing signature headers", { status: 400 });
  }

  // Must read the raw body before parsing — signature is computed over the
  // exact bytes Yoco sent, not our re-serialized JSON.
  const rawBody = await request.text();

  const valid = verifyYocoWebhookSignature({
    rawBody,
    webhookId,
    webhookTimestamp,
    webhookSignature,
    secret,
  });
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    type: string;
    payload?: { id?: string };
  };

  if (event.type !== "payment.succeeded") {
    // Ack anything we don't act on so Yoco stops retrying it.
    return new Response("OK", { status: 200 });
  }

  const checkoutId = event.payload?.id;
  if (!checkoutId) {
    return new Response("Missing checkout id in payload", { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: registration, error: lookupError } = await supabase
    .from("registrations")
    .select("id, payment_status")
    .eq("yoco_checkout_id", checkoutId)
    .maybeSingle();

  if (lookupError) {
    console.error("Yoco webhook: registration lookup failed", lookupError);
    return new Response("Lookup failed", { status: 500 });
  }
  if (!registration) {
    // Nothing to do — ack so Yoco doesn't keep retrying a checkout we don't
    // recognize (e.g. a stale/test session).
    return new Response("OK", { status: 200 });
  }
  if (registration.payment_status === "paid") {
    // Already handled — Yoco retries webhook delivery, this must be a no-op.
    return new Response("OK", { status: 200 });
  }

  const { error: updateError } = await supabase
    .from("registrations")
    .update({ payment_status: "paid", paid_at: new Date().toISOString(), paid_via: "yoco" })
    .eq("id", registration.id);

  if (updateError) {
    console.error("Yoco webhook: failed to mark registration paid", updateError);
    return new Response("Update failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
