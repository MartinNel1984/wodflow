import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { deriveJudgePassword } from "@/lib/judges";
import { NextResponse } from "next/server";

// Name + 4-digit PIN login for judges. The PIN is verified server-side
// (with lockout) via the verify_user_pin RPC; on success we sign the
// user into Supabase with their deterministic derived password, which
// sets the auth session cookies. Ported from tcrpv-portal's pin-login route.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const profileId = body?.profileId as string | undefined;
  const pin = body?.pin as string | undefined;

  if (!profileId || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "Enter your name and a 4-digit PIN." }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: result, error } = await svc.rpc("verify_user_pin", {
    p_profile: profileId,
    p_pin: pin,
  });

  if (error) {
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }

  const status = (result as { status?: string })?.status;

  if (status === "locked") {
    return NextResponse.json(
      { error: "Too many wrong PINs. Try again in 15 minutes." },
      { status: 423 }
    );
  }
  if (status === "no_pin") {
    return NextResponse.json(
      { error: "No PIN set yet — ask the organizer to set your PIN." },
      { status: 403 }
    );
  }
  if (status !== "ok") {
    const left = (result as { attempts_left?: number })?.attempts_left;
    return NextResponse.json(
      {
        error:
          left != null
            ? `Wrong PIN. ${left} attempt${left === 1 ? "" : "s"} left.`
            : "Wrong PIN.",
      },
      { status: 401 }
    );
  }

  // PIN verified — establish the real Supabase session.
  const { data: userRes, error: uErr } = await svc.auth.admin.getUserById(profileId);
  if (uErr || !userRes?.user?.email) {
    return NextResponse.json({ error: "Account not found." }, { status: 500 });
  }

  const secret = process.env.PIN_LOGIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const password = await deriveJudgePassword(secret, profileId);
  const supabase = await createServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: userRes.user.email,
    password,
  });

  if (signInErr) {
    return NextResponse.json(
      { error: "Login failed. Ask the organizer to reset your PIN." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
