import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// Public list of judges for the PIN login screen. Returns ONLY safe
// display fields (name) — never emails or PIN hashes. Only profiles
// that have a PIN set are shown.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "judge")
    .eq("pin_set", true)
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ judges: data ?? [] });
}
