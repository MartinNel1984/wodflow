// PIN-auth helper shared by the seed script and the login API route.
// Derives a deterministic Supabase auth password from a server secret
// + the user's id, so PIN login can mint a real session without
// storing a second password anywhere. Adapted from tcrpv-portal's
// lib/staff.ts — each app has its own PIN_LOGIN_SECRET and prefix.
export async function deriveJudgePassword(secret: string, userId: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(userId));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `WF1!${hex}`;
}
