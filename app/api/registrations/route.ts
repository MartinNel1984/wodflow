import { createServiceClient } from "@/lib/supabase/service";
import { createYocoCheckout } from "@/lib/yoco";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Teammate = { fullName: string; email: string; isCaptain: boolean };

function currentPrice(division: {
  price_early: number | null;
  price_normal: number;
  price_late: number | null;
  early_bird_ends: string | null;
  late_starts: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  if (division.price_early != null && division.early_bird_ends && today <= division.early_bird_ends) {
    return division.price_early;
  }
  if (division.price_late != null && division.late_starts && today >= division.late_starts) {
    return division.price_late;
  }
  return division.price_normal;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const divisionId = body?.divisionId as string | undefined;
  const teamName = (body?.teamName as string | undefined)?.trim() || null;
  const teammates = (body?.teammates as Teammate[] | undefined) ?? [];
  const waiverSignedName = (body?.waiverSignedName as string | undefined)?.trim();

  if (!divisionId || teammates.length === 0 || !waiverSignedName) {
    return NextResponse.json({ error: "Missing required registration fields." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: division, error: divError } = await supabase
    .from("divisions")
    .select("id, name, team_size, price_early, price_normal, price_late, early_bird_ends, late_starts, event_id")
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
    })
    .select("id")
    .single();

  if (regError || !registration) {
    return NextResponse.json({ error: "Could not create registration." }, { status: 500 });
  }

  const athleteRows = teammates.map((t) => ({
    registration_id: registration.id,
    full_name: t.fullName.trim(),
    email: t.email.trim().toLowerCase(),
    is_captain: t.isCaptain,
    waiver_signed_name: waiverSignedName,
    waiver_signed_at: waiverTimestamp,
    waiver_ip: clientIp,
  }));

  const { error: athletesError } = await supabase.from("registration_athletes").insert(athleteRows);
  if (athletesError) {
    // Roll back the registration so we don't leave an orphaned, unpayable row.
    await supabase.from("registrations").delete().eq("id", registration.id);
    return NextResponse.json({ error: "Could not save athlete details." }, { status: 500 });
  }

  const captain = teammates.find((t) => t.isCaptain) ?? teammates[0];

  try {
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
    console.error("Yoco checkout creation failed", err);
    return NextResponse.json(
      { error: "Registration saved, but payment setup failed. Please contact the organizer." },
      { status: 502 }
    );
  }
}
