import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TSHIRT_SIZES = ["S", "M", "L", "XL", "XXL"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const eventId = (body?.eventId as string | undefined)?.trim();
  const firstName = (body?.firstName as string | undefined)?.trim();
  const lastName = (body?.lastName as string | undefined)?.trim();
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const cell = (body?.cell as string | undefined)?.trim();
  const tshirtSize = body?.tshirtSize as string | undefined;
  const judgedBefore = Boolean(body?.judgedBefore);

  if (!eventId || !firstName || !lastName || !email || !email.includes("@") || !cell) {
    return NextResponse.json({ error: "Please fill in all the required fields." }, { status: 400 });
  }
  if (!tshirtSize || !TSHIRT_SIZES.includes(tshirtSize)) {
    return NextResponse.json({ error: "Please select a t-shirt size." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (!["published", "live"].includes(event.status)) {
    return NextResponse.json({ error: "Judge signups for this event aren't open." }, { status: 403 });
  }

  const { error: insertError } = await supabase.from("judge_applications").insert({
    event_id: event.id,
    first_name: firstName,
    last_name: lastName,
    email,
    cell,
    tshirt_size: tshirtSize,
    judged_before: judgedBefore,
  });

  if (insertError) {
    console.error("Could not save judge application", insertError);
    return NextResponse.json({ error: "Could not submit your application. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
