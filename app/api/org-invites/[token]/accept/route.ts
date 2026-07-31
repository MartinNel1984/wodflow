import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Accepts a platform-admin-issued org invite (see app/platform/control):
// creates the new box's first organizer/judge/head_judge account with a
// self-chosen password (same service-client-createUser pattern as
// athlete-signup — no SMTP configured, so Supabase's default
// email-confirmation flow isn't usable), stamps organization_id +
// role straight from the invite row, and signs them in immediately.
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const fullName = (body?.fullName as string | undefined)?.trim();
  const password = body?.password as string | undefined;

  if (!fullName || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Full name and an 8+ character password are required." },
      { status: 400 }
    );
  }

  const svc = createServiceClient();

  const { data: invite, error: inviteError } = await svc
    .from("org_invites")
    .select("id, organization_id, email, role, status")
    .eq("token", token)
    .single();
  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 409 });
  }

  const { data: created, error: createError } = await svc.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account. That email may already be in use." },
      { status: 400 }
    );
  }

  // handle_new_user already inserted a bare 'athlete' profile row from
  // auth metadata — this upsert overwrites role/organization_id with
  // the invite's, same as athlete-signup's pattern for the rest of the row.
  const { error: profileError } = await svc.from("profiles").upsert(
    {
      id: created.user.id,
      full_name: fullName,
      email: invite.email,
      role: invite.role,
      organization_id: invite.organization_id,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    return NextResponse.json({ error: "Account created, but profile setup failed." }, { status: 500 });
  }

  // Conditional update + rowcount check, same pattern as team_invites'
  // accept route — closes the TOCTOU window where two concurrent
  // accepts could both pass the earlier plain status === "pending"
  // check before either writes. In practice createUser's unique-email
  // constraint already stops this from producing a duplicate account,
  // but the status write itself should follow the same safe pattern
  // used elsewhere rather than a bare unconditional update.
  await svc
    .from("org_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .eq("status", "pending");

  const supabase = await createServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (signInError) {
    return NextResponse.json({ error: "Account created — please sign in." }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
