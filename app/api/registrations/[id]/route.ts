import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Used by the confirmation page on reload — returns the cached pay_url
// rather than the registration wizard ever creating a second Yoco
// checkout for the same registration.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("registrations")
    .select("id, payment_status, pay_url, team_name, price_paid, divisions(name)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  return NextResponse.json({ registration: data });
}
