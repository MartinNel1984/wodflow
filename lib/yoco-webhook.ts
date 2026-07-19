import { createHmac, timingSafeEqual } from "crypto";

// Yoco webhooks follow the Standard Webhooks spec: the signed content is
// "{id}.{timestamp}.{raw body}", HMAC-SHA256'd with the base64 portion of
// the whsec_... secret, base64-encoded, and compared against one of the
// space-delimited "v1,<sig>" values in the webhook-signature header.
// Ported verbatim from nudgepay's lib/yoco-webhook.ts.
export function verifyYocoWebhookSignature(params: {
  rawBody: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
  secret: string;
}): boolean {
  const { rawBody, webhookId, webhookTimestamp, webhookSignature, secret } = params;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  const candidates = webhookSignature.split(" ").map((part) => part.split(",")[1]).filter(Boolean);

  return candidates.some((candidate) => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
