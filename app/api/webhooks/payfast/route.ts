import { createServiceClient } from "@/lib/supabase/service";
import { verifyPayfastSignature, validatePayfastItn } from "@/lib/payfast-webhook";
import { sendRegistrationEmails } from "@/lib/email";

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
  const registrationId = params.get("m_payment_id");
  const amountGross = params.get("amount_gross");
  const pfPaymentId = params.get("pf_payment_id");

  if (!registrationId) {
    return new Response("Missing m_payment_id", { status: 400 });
  }
  if (paymentStatus !== "COMPLETE") {
    // Ack anything we don't act on so PayFast stops retrying it.
    return new Response("OK", { status: 200 });
  }

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

  if (amountGross && Math.abs(parseFloat(amountGross) - Number(registration.price_paid)) > 0.5) {
    console.error("PayFast webhook: amount mismatch", {
      registrationId,
      amountGross,
      expected: registration.price_paid,
    });
    return new Response("Amount mismatch", { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("registrations")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      paid_via: "payfast",
      payfast_payment_id: pfPaymentId,
    })
    .eq("id", registrationId);

  if (updateError) {
    console.error("PayFast webhook: failed to mark registration paid", updateError);
    return new Response("Update failed", { status: 500 });
  }

  await sendRegistrationEmails(registrationId).catch((err) =>
    console.error("PayFast webhook: sendRegistrationEmails failed", err)
  );

  return new Response("OK", { status: 200 });
}
