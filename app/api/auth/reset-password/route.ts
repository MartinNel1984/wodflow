import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = (body?.token as string | undefined)?.trim();
  const password = body?.password as string | undefined;

  if (!token || !password || password.length < 8) {
    return NextResponse.json(
      { error: "A valid link and an 8+ character password are required." },
      { status: 400 }
    );
  }

  const svc = createServiceClient();

  const { data: tokenRow, error: tokenError } = await svc
    .from("password_reset_tokens")
    .select("id, profile_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "This reset link is invalid." }, { status: 404 });
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: "This reset link has already been used." }, { status: 409 });
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "This reset link has expired. Request a new one." }, { status: 409 });
  }

  const { error: updateError } = await svc.auth.admin.updateUserById(tokenRow.profile_id, { password });
  if (updateError) {
    return NextResponse.json({ error: "Could not update password. Try again." }, { status: 500 });
  }

  // Conditional update on used_at is null, same TOCTOU-safe pattern as
  // org_invites' accept route — the password change above already can't
  // happen twice with effect, but this keeps the token row honest too.
  await svc
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
    .is("used_at", null);

  return NextResponse.json({ ok: true });
}
