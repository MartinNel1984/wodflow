import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The token itself is the capability — the invitee has no account (or
// at least no profile_id link) yet, so RLS on team_invites/
// registration_athletes can't be the gate here. Service-role lookup,
// deliberately returning only what an invitee needs to see: no PII
// about other teammates, no payment details.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: invite, error } = await supabase
    .from("team_invites")
    .select(
      "status, email_or_phone, registration_athlete_id, registrations(team_name, divisions(name, events(name, waiver_text)))"
    )
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const { data: athlete } = await supabase
    .from("registration_athletes")
    .select("full_name, email, id_number, is_minor, guardian_name, guardian_id_number")
    .eq("id", invite.registration_athlete_id)
    .single();

  const registration = Array.isArray(invite.registrations) ? invite.registrations[0] : invite.registrations;
  const division = Array.isArray(registration?.divisions) ? registration.divisions[0] : registration?.divisions;
  const event = Array.isArray(division?.events) ? division.events[0] : division?.events;

  return NextResponse.json({
    status: invite.status,
    teamName: registration?.team_name ?? null,
    divisionName: division?.name ?? null,
    eventName: event?.name ?? null,
    waiverText: event?.waiver_text ?? null,
    athlete,
  });
}
