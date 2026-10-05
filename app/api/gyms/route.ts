import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/gyms — approved gyms, alphabetical. Used by the signup
// and profile-edit dropdowns.
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyms")
    .select("id, name")
    .eq("approved", true)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gyms: data ?? [] });
}

// POST /api/gyms { name } — athlete can propose a new gym. Lands as
// pending for the organiser to review and either approve or rename
// (e.g. "ATG Bryanston" → "ATG CrossFit Bryanston"). Returns the gym
// row (new or existing) so the picker can select it immediately.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const nameRaw = (body?.name as string | undefined) ?? "";
  const name = nameRaw.trim().replace(/\s+/g, " ");
  if (!name) return NextResponse.json({ error: "Gym name required." }, { status: 400 });
  if (name.length > 120) return NextResponse.json({ error: "Gym name too long." }, { status: 400 });

  // Anon captains during registration can also propose a gym; the row is
  // pending until an organiser reviews it, so no auth gate here. Rate
  // limiting the signup flow sits upstream.

  // Match case-insensitively against the full table (service client bypasses
  // the "approved only" select policy, so we also surface pending gyms
  // instead of racing to insert a duplicate pending row).
  const svc = createServiceClient();
  const { data: existing } = await svc
    .from("gyms")
    .select("id, name, approved")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return NextResponse.json({ gym: existing });

  const { data: created, error } = await svc
    .from("gyms")
    .insert({ name, approved: false })
    .select("id, name, approved")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gym: created });
}
