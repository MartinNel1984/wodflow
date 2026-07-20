import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Links the signed-in athlete to their teammate's placeholder
// registration_athletes row and records THEIR OWN waiver signature —
// overwriting whatever the captain entered on their behalf at team
// registration time. Requires a real session (any athlete account);
// deliberately does not require the session's email to match the
// invite's email_or_phone — real people often sign up with a
// different address than whichever one the captain typed.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const fullName = (body?.fullName as string | undefined)?.trim();
  const idNumber = (body?.idNumber as string | undefined)?.trim();
  const isMinor = Boolean(body?.isMinor);
  const guardianName = (body?.guardianName as string | undefined)?.trim();
  const guardianIdNumber = (body?.guardianIdNumber as string | undefined)?.trim();
  const waiverSignedName = (body?.waiverSignedName as string | undefined)?.trim();
  const waiverAccepted = Boolean(body?.waiverAccepted);

  if (!fullName || !idNumber || !waiverSignedName || !waiverAccepted) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (isMinor && (!guardianName || !guardianIdNumber)) {
    return NextResponse.json(
      { error: "A parent/guardian name and ID number are required for minors." },
      { status: 400 }
    );
  }

  const sessionClient = await createServerClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const svc = createServiceClient();

  const { data: invite, error: inviteError } = await svc
    .from("team_invites")
    .select("id, status, registration_athlete_id, registrations(division_id, divisions(event_id))")
    .eq("token", token)
    .single();
  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (invite.status === "accepted") {
    return NextResponse.json({ error: "This invite has already been claimed." }, { status: 409 });
  }

  const registration = Array.isArray(invite.registrations) ? invite.registrations[0] : invite.registrations;
  const division = Array.isArray(registration?.divisions) ? registration.divisions[0] : registration?.divisions;
  const eventId = division?.event_id;
  const { data: event } = eventId
    ? await svc.from("events").select("waiver_text").eq("id", eventId).single()
    : { data: null };

  const clientIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? null;

  const { error: updateError } = await svc
    .from("registration_athletes")
    .update({
      profile_id: user.id,
      full_name: fullName,
      id_number: idNumber,
      is_minor: isMinor,
      guardian_name: isMinor ? guardianName : null,
      guardian_id_number: isMinor ? guardianIdNumber : null,
      waiver_signed_name: waiverSignedName,
      waiver_signed_at: new Date().toISOString(),
      waiver_ip: clientIp,
      waiver_text_snapshot: event?.waiver_text ?? null,
    })
    .eq("id", invite.registration_athlete_id);
  if (updateError) {
    return NextResponse.json({ error: "Could not save your details." }, { status: 500 });
  }

  await svc
    .from("team_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_profile_id: user.id })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true });
}
