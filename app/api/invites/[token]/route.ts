import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The token is the capability to reach this invite — but the invited
// athlete's PII (ID number, guardian ID number, email) is only returned
// once the visitor is actually signed in. An invite link travels over
// WhatsApp/email/SMS and gets forwarded; returning a South African ID
// number to anyone merely holding the (shareable) link would be a real
// exposure. The unauthenticated response is limited to the non-PII
// preview an invitee needs to decide to sign in: event/division/team
// name, invite status, and the (public) waiver text.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: invite, error } = await supabase
    .from("team_invites")
    .select(
      "status, registration_athlete_id, registrations(team_name, divisions(name, events(name, waiver_text)))"
    )
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const registration = Array.isArray(invite.registrations) ? invite.registrations[0] : invite.registrations;
  const division = Array.isArray(registration?.divisions) ? registration.divisions[0] : registration?.divisions;
  const event = Array.isArray(division?.events) ? division.events[0] : division?.events;

  // Only include the athlete pre-fill (name + ID + guardian details) for
  // a signed-in visitor. The invite page re-fetches after sign-in, so the
  // acceptance form still pre-fills correctly once the teammate is authed.
  const sessionClient = await createServerClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  let athlete = null;
  if (user) {
    const { data } = await supabase
      .from("registration_athletes")
      .select("full_name, email, id_number, is_minor, guardian_name, guardian_id_number")
      .eq("id", invite.registration_athlete_id)
      .single();
    athlete = data;
  }

  return NextResponse.json({
    status: invite.status,
    teamName: registration?.team_name ?? null,
    divisionName: division?.name ?? null,
    eventName: event?.name ?? null,
    waiverText: event?.waiver_text ?? null,
    athlete,
  });
}
