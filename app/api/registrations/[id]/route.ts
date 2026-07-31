import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function oneOf<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

// Backs the confirmation page's payment-status poll. Receipt-level fields
// (payment status, price, team/division name, cached pay_url) are returned
// to anyone holding the registration's unguessable UUID — anonymous
// registrants rely on this to see their own confirmation. The team invite
// tokens and teammate email addresses are sensitive, though (a token lets
// its holder claim a team slot and — via the invite lookup — reach a
// teammate's ID number), so those are returned ONLY to the authenticated
// captain of this registration, or to an organizer AT THE SAME
// ORGANIZATION as this registration's event (a bare role check
// previously let any organizer on the platform read another org's
// team-invite tokens for any registration id they got hold of).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = createServiceClient();

  const { data, error } = await svc
    .from("registrations")
    .select(
      "id, payment_status, pay_url, team_name, price_paid, captain_profile_id, divisions(name, events(poster_url, organization_id, brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline))), team_invites(token, email_or_phone, status)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const division = oneOf(data.divisions);
  const event = division ? oneOf(division.events) : undefined;
  const eventOrganizationId = event?.organization_id ?? null;

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
        .select("role, organization_id")
        .eq("id", user.id)
        .single();
      canSeeInvites = profile?.role === "organizer" && profile.organization_id === eventOrganizationId;
    }
  }

  // Never expose captain_profile_id, the internal organization_id (only
  // fetched above to scope canSeeInvites), or team_invites unless
  // authorized.
  const { poster_url, brand_kits } = event ?? {};
  return NextResponse.json({
    registration: {
      id: data.id,
      payment_status: data.payment_status,
      pay_url: data.pay_url,
      team_name: data.team_name,
      price_paid: data.price_paid,
      divisions: division ? { name: division.name, events: { poster_url, brand_kits } } : null,
      ...(canSeeInvites ? { team_invites: data.team_invites } : {}),
    },
  });
}
