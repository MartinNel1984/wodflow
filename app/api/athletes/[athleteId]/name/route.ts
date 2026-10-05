import { requireOrganizer } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/athletes/:athleteId/name { fullName } — organiser fixes an
// athlete's displayed name from the /athletes page. Writes to the
// registration_athletes row (what shows in exports, waivers, team view)
// and, if the athlete has claimed a profile, to profiles.full_name so
// their portal and the public leaderboard (which reads
// public_team_rosters.full_name) stay in sync.
export async function PATCH(request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  try {
    await requireOrganizer();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorised." }, { status: 403 });
  }
  const { athleteId } = await params;
  const body = await request.json().catch(() => null);
  const raw = body?.fullName;
  const fullName = typeof raw === "string" ? raw.trim() : "";
  if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });

  const svc = createServiceClient();
  const { data: athlete, error: readErr } = await svc
    .from("registration_athletes")
    .select("id, profile_id")
    .eq("id", athleteId)
    .single();
  if (readErr || !athlete) return NextResponse.json({ error: "Athlete not found." }, { status: 404 });

  const { error: raErr } = await svc
    .from("registration_athletes")
    .update({ full_name: fullName })
    .eq("id", athleteId);
  if (raErr) return NextResponse.json({ error: raErr.message }, { status: 500 });

  if (athlete.profile_id) {
    await svc.from("profiles").update({ full_name: fullName }).eq("id", athlete.profile_id);
  }
  return NextResponse.json({ ok: true, fullName });
}
