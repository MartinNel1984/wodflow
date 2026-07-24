import { createHash } from "crypto";

function encode(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

// Reuse the exact bytes from the raw ITN body (already encoded the way
// PayFast's server sent them) rather than decoding + re-encoding, which
// risks a mismatch (e.g. %20 vs + normalization) against PayFast's own hash.
function rawPairsExcludingSignature(rawBody: string): string {
  return rawBody
    .split("&")
    .filter((pair) => !pair.startsWith("signature="))
    .join("&");
}

export function verifyPayfastSignature(rawBody: string): boolean {
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const params = new URLSearchParams(rawBody);
  const received = params.get("signature");
  if (!received) return false;

  let base = rawPairsExcludingSignature(rawBody);
  if (passphrase) base += `&passphrase=${encode(passphrase)}`;

  const expected = createHash("md5").update(base).digest("hex");
  return expected === received;
}

// Second, independent check per PayFast's own integration guide: post the
// ITN data back to PayFast and confirm they recognize it as a payment they
// actually sent, rather than trusting the signature match alone.
export async function validatePayfastItn(rawBody: string): Promise<boolean> {
  const host = process.env.PAYFAST_MODE === "sandbox" ? "sandbox.payfast.co.za" : "www.payfast.co.za";
  const res = await fetch(`https://${host}/eng/query/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: rawBody,
  });
  const text = (await res.text()).trim();
  return text === "VALID";
}
