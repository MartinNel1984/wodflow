import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createYocoCheckout } from "@/lib/yoco";
import { createPayfastCheckout } from "@/lib/payfast";
import { currentPrice } from "@/lib/pricing";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Teammate = {
  fullName: string;
  email: string;
  isCaptain: boolean;
  idNumber: string;
  isMinor: boolean;
  guardianName: string;
  guardianIdNumber: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const divisionId = body?.divisionId as string | undefined;
  const teamName = (body?.teamName as string | undefined)?.trim() || null;
  const teammates = (body?.teammates as Teammate[] | undefined) ?? [];
  const waiverSignedName = (body?.waiverSignedName as string | undefined)?.trim();

  if (!divisionId || teammates.length === 0 || !waiverSignedName) {
    return NextResponse.json({ error: "Missing required registration fields." }, { status: 400 });
  }
  for (const t of teammates) {
    if (!t.idNumber?.trim()) {
      return NextResponse.json({ error: "Every athlete needs an ID number." }, { status: 400 });
    }
    if (t.isMinor && (!t.guardianName?.trim() || !t.guardianIdNumber?.trim())) {
      return NextResponse.json(
        { error: "A parent/guardian name and ID number are required for minors." },
        { status: 400 }
      );
    }
  }

  // Derived from the real session, never trusted from the request body —
  // a client could otherwise claim any profile as the registering athlete.
  // Anonymous registration still works fine; this is just null then.
  const sessionClient = await createServerClient();
  const {
    data: { user: sessionUser },
  } = await sessionClient.auth.getUser();

  const supabase = createServiceClient();

  const { data: division, error: divError } = await supabase
    .from("divisions")
    .select(
      "id, name, team_size, price_early, price_normal, price_late, early_bird_ends, late_starts, event_id, max_entries"
    )
    .eq("id", divisionId)
    .single();

  if (divError || !division) {
    return NextResponse.json({ error: "Division not found." }, { status: 404 });
  }
  if (teammates.length !== division.team_size) {
    return NextResponse.json(
      { error: `This division requires exactly ${division.team_size} athlete(s).` },
      { status: 400 }
    );
  }

  if (division.max_entries != null) {
    // Refunded entries free up their slot; pending/paid/waived all hold one.
    const { count } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("division_id", divisionId)
      .neq("payment_status", "refunded");
    if ((count ?? 0) >= division.max_entries) {
      return NextResponse.json({ error: "This division is full." }, { status: 409 });
    }
  }

  const { data: event } = await supabase
    .from("events")
    .select("waiver_text, status, payment_provider")
    .eq("id", division.event_id)
    .single();

  // Registration is only open once the organizer has published the event.
  // Blocks registering (and paying) for a draft/archived event by guessing
  // a division UUID before it's meant to be live.
  if (!event || !["published", "live"].includes(event.status)) {
    return NextResponse.json({ error: "Registration for this event isn't open." }, { status: 403 });
  }

  const price = currentPrice(division);
  const waiverTimestamp = new Date().toISOString();
  const clientIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? null;

  const { data: registration, error: regError } = await supabase
    .from("registrations")
    .insert({
      event_id: division.event_id,
      division_id: division.id,
      team_name: teamName,
      price_paid: price,
      captain_profile_id: sessionUser?.id ?? null,
    })
    .select("id")
    .single();

  if (regError || !registration) {
    // The DB trigger enforce_division_max_entries is the source of truth
    // (the count check above is just a fast-path pre-check, not a lock,
    // so concurrent submissions for the last slot can both pass it).
    if (regError?.message?.includes("Division is full")) {
      return NextResponse.json({ error: "This division is full." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create registration." }, { status: 500 });
  }

  const athleteRows = teammates.map((t) => ({
    registration_id: registration.id,
    profile_id: t.isCaptain ? (sessionUser?.id ?? null) : null,
    full_name: t.fullName.trim(),
    email: t.email.trim().toLowerCase(),
    is_captain: t.isCaptain,
    id_number: t.idNumber.trim(),
    is_minor: t.isMinor,
    guardian_name: t.isMinor ? t.guardianName.trim() : null,
    guardian_id_number: t.isMinor ? t.guardianIdNumber.trim() : null,
    waiver_signed_name: waiverSignedName,
    waiver_signed_at: waiverTimestamp,
    waiver_ip: clientIp,
    // Snapshot the exact text agreed to right now — events.waiver_text
    // may be edited later, but this athlete's record must keep showing
    // what they actually signed (see migration-010's rationale).
    waiver_text_snapshot: event?.waiver_text ?? null,
  }));

  const { data: insertedAthletes, error: athletesError } = await supabase
    .from("registration_athletes")
    .insert(athleteRows)
    .select("id, email, is_captain");
  if (athletesError || !insertedAthletes) {
    // Roll back the registration so we don't leave an orphaned, unpayable row.
    await supabase.from("registrations").delete().eq("id", registration.id);
    return NextResponse.json({ error: "Could not save athlete details." }, { status: 500 });
  }

  // Team divisions: give every non-captain teammate their own claim
  // link so they can sign in/up, link their own account to this
  // registration, and independently re-sign their own waiver — the
  // captain's entry above is a placeholder signature, not a substitute
  // for each teammate's own indemnity (per the design doc's team-invite
  // decision).
  const nonCaptainRows = insertedAthletes.filter((a) => !a.is_captain);
  if (nonCaptainRows.length > 0) {
    const { error: inviteError } = await supabase.from("team_invites").insert(
      nonCaptainRows.map((a) => ({
        registration_id: registration.id,
        registration_athlete_id: a.id,
        email_or_phone: a.email,
        invited_by: sessionUser?.id ?? null,
      }))
    );
    // Not fatal to the registration — the captain already has each
    // teammate's details, and payment/roster still work without a
    // claim link. Log so it's visible if invites are silently failing.
    if (inviteError) console.error("Could not create team invites", inviteError);
  }

  const captain = teammates.find((t) => t.isCaptain) ?? teammates[0];

  try {
    if (event.payment_provider === "payfast") {
      const { payUrl } = createPayfastCheckout({
        amountRands: price,
        registrationId: registration.id,
        divisionName: division.name,
        teamOrAthleteName: teamName ?? captain.fullName,
        athleteEmail: captain.email,
        siteOrigin: new URL(request.url).origin,
      });

      await supabase.from("registrations").update({ pay_url: payUrl }).eq("id", registration.id);

      return NextResponse.json({ registrationId: registration.id, payUrl });
    }

    const { checkoutId, payUrl } = await createYocoCheckout({
      amountRands: price,
      registrationId: registration.id,
      divisionName: division.name,
      teamOrAthleteName: teamName ?? captain.fullName,
    });

    await supabase
      .from("registrations")
      .update({ yoco_checkout_id: checkoutId, pay_url: payUrl })
      .eq("id", registration.id);

    return NextResponse.json({ registrationId: registration.id, payUrl });
  } catch (err) {
    console.error("Checkout creation failed", err);
    return NextResponse.json(
      { error: "Registration saved, but payment setup failed. Please contact the organizer." },
      { status: 502 }
    );
  }
}
