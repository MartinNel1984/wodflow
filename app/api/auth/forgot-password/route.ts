import { createServiceClient } from "@/lib/supabase/service";
import { sendPasswordResetEmail } from "@/lib/email";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Always returns the same generic response whether or not the email
// matched an account — never let this endpoint be used to enumerate
// registered emails.
const GENERIC_RESPONSE = { ok: true };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  if (!email) return NextResponse.json(GENERIC_RESPONSE);

  const svc = createServiceClient();

  const { data: profile } = await svc
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (profile) {
    const { data: tokenRow, error: tokenError } = await svc
      .from("password_reset_tokens")
      .insert({ profile_id: profile.id })
      .select("token")
      .single();

    if (tokenError || !tokenRow) {
      console.error("forgot-password: could not create reset token", tokenError);
    } else {
      await sendPasswordResetEmail(profile.email, tokenRow.token);
    }
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
