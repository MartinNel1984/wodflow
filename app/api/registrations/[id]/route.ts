import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Backs the confirmation page's payment-status poll. Receipt-level fields
// (payment status, price, team/division name, cached pay_url) are returned
// to anyone holding the registration's unguessable UUID — anonymous
// registrants rely on this to see their own confirmation. The team invite
// tokens and teammate email addresses are sensitive, though (a token lets
// its holder claim a team slot and — via the invite lookup — reach a
// teammate's ID number), so those are returned ONLY to the authenticated
// captain of this registration, or to an organizer.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = createServiceClient();

  const { data, error } = await svc
    .from("registrations")
    .select(
      "id, payment_status, pay_url, team_name, price_paid, captain_profile_id, divisions(name), team_invites(token, email_or_phone, status)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const sessionClient = await createServerClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  let canSeeInvites = false;
  if (user) {
    if (user.id === data.captain_profile_id) {
      canSeeInvites = true;
    } else {
      const { data: profile } = await sessionClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      canSeeInvites = profile?.role === "organizer";
    }
  }

  // Never expose captain_profile_id; only surface team_invites when authorized.
  const { captain_profile_id: _captain, team_invites, ...receipt } = data;
  void _captain;
  return NextResponse.json({
    registration: canSeeInvites ? { ...receipt, team_invites } : receipt,
  });
}
