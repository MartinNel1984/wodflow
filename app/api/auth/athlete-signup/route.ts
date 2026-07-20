import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Self-serve athlete signup. Created via the service client with
// email_confirm: true (same pattern as judge/head_judge account
// creation) rather than the client-side supabase.auth.signUp() flow,
// which would depend on Supabase's default email-confirmation delivery
// — no SMTP is configured for Wodflow, so that path would silently
// strand new athletes waiting on an email that never sends. The
// athlete picks their own real password here (unlike judges' PIN-
// derived one), so once created we sign them in immediately with it.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const fullName = (body?.fullName as string | undefined)?.trim();
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const password = body?.password as string | undefined;
  const phone = (body?.phone as string | undefined)?.trim() || null;
  const idNumber = (body?.idNumber as string | undefined)?.trim() || null;

  if (!fullName || !email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Full name, email, and an 8+ character password are required." },
      { status: 400 }
    );
  }

  const svc = createServiceClient();

  const { data: created, error: createError } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account. That email may already be in use." },
      { status: 400 }
    );
  }

  // The handle_new_user trigger already inserted a bare profile row
  // (full_name/email from auth metadata, role defaults 'athlete') —
  // this upsert fills in the rest (phone, ID number) atomically.
  const { error: profileError } = await svc
    .from("profiles")
    .upsert(
      { id: created.user.id, full_name: fullName, email, phone, id_number: idNumber, role: "athlete" },
      { onConflict: "id" }
    );
  if (profileError) {
    return NextResponse.json({ error: "Account created, but profile setup failed." }, { status: 500 });
  }

  const supabase = await createServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json(
      { error: "Account created — please sign in." },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true });
}
