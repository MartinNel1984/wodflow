import { createHash } from "crypto";

// PayFast requires the signature (and the redirect query string itself) to
// use the exact same field order and encoding — their server recomputes
// the hash over the raw string it receives, so signature generation and
// URL-building must share one encoder/order to avoid a silent mismatch.
function encode(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

const FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "m_payment_id",
  "amount",
  "item_name",
] as const;

function buildQueryString(fields: Record<string, string>) {
  return FIELD_ORDER.filter((k) => fields[k])
    .map((k) => `${k}=${encode(fields[k])}`)
    .join("&");
}

// Generic checkout params — id is the m_payment_id PayFast will hand back
// on the webhook (registrations pass their raw registration id; tickets
// prefix theirs with "ticket_" so the webhook can branch on which table
// to look the payment up in, see app/api/webhooks/payfast/route.ts).
// returnUrl/cancelUrl default to a registration-confirmation URL built
// from id for back-compat with the one existing call site, but callers
// should pass their own — kept optional only so this change is additive.
export function createPayfastCheckout(params: {
  amountRands: number;
  id: string;
  itemName: string;
  buyerName: string;
  buyerEmail: string;
  siteOrigin: string;
  returnUrl?: string;
  cancelUrl?: string;
}) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  if (!merchantId || !merchantKey) throw new Error("PAYFAST_MERCHANT_ID/PAYFAST_MERCHANT_KEY is not set");

  const [firstName, ...rest] = params.buyerName.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  const defaultReturnUrl = `${params.siteOrigin}/register/confirmation/${params.id}`;

  const fields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: params.returnUrl ?? defaultReturnUrl,
    cancel_url: params.cancelUrl ?? defaultReturnUrl,
    notify_url: `${params.siteOrigin}/api/webhooks/payfast`,
    name_first: firstName || "Guest",
    name_last: lastName || "Guest",
    email_address: params.buyerEmail,
    m_payment_id: params.id,
    amount: params.amountRands.toFixed(2),
    item_name: params.itemName.slice(0, 100),
  };

  let signatureBase = buildQueryString(fields);
  if (passphrase) signatureBase += `&passphrase=${encode(passphrase)}`;
  const signature = createHash("md5").update(signatureBase).digest("hex");

  const host = process.env.PAYFAST_MODE === "sandbox" ? "sandbox.payfast.co.za" : "www.payfast.co.za";
  const payUrl = `https://${host}/eng/process?${buildQueryString(fields)}&signature=${signature}`;

  return { payUrl };
}
