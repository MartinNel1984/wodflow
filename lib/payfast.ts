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

export function createPayfastCheckout(params: {
  amountRands: number;
  registrationId: string;
  divisionName: string;
  teamOrAthleteName: string;
  athleteEmail: string;
  siteOrigin: string;
}) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  if (!merchantId || !merchantKey) throw new Error("PAYFAST_MERCHANT_ID/PAYFAST_MERCHANT_KEY is not set");

  const [firstName, ...rest] = params.teamOrAthleteName.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  const fields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${params.siteOrigin}/register/confirmation/${params.registrationId}`,
    cancel_url: `${params.siteOrigin}/register/confirmation/${params.registrationId}`,
    notify_url: `${params.siteOrigin}/api/webhooks/payfast`,
    name_first: firstName || "Athlete",
    name_last: lastName || "Athlete",
    email_address: params.athleteEmail,
    m_payment_id: params.registrationId,
    amount: params.amountRands.toFixed(2),
    item_name: params.divisionName.slice(0, 100),
  };

  let signatureBase = buildQueryString(fields);
  if (passphrase) signatureBase += `&passphrase=${encode(passphrase)}`;
  const signature = createHash("md5").update(signatureBase).digest("hex");

  const host = process.env.PAYFAST_MODE === "sandbox" ? "sandbox.payfast.co.za" : "www.payfast.co.za";
  const payUrl = `https://${host}/eng/process?${buildQueryString(fields)}&signature=${signature}`;

  return { payUrl };
}
