import { requireOrganizer } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/athletes/:athleteId/gym { gymName } — organiser edits an
// athlete's gym from the /athletes page. Writes to both the
// registration_athletes row (what shows on the directory table + CSV
// export) and, if the athlete has claimed a profile, to profiles.gym_name
// so their own portal view stays in sync. gymName must already be an
// approved gym (the picker only lets the organiser select from the
// approved list); null clears it.
export async function PATCH(request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  try {
    await requireOrganizer();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorised." }, { status: 403 });
  }
  const { athleteId } = await params;
  const body = await request.json().catch(() => null);
  const gymNameRaw = body?.gymName as string | null | undefined;
  const gymName = typeof gymNameRaw === "string" ? gymNameRaw.trim() || null : null;

  const svc = createServiceClient();
  if (gymName) {
    const { data: gym } = await svc
      .from("gyms")
      .select("name, approved")
      .ilike("name", gymName)
      .maybeSingle();
    if (!gym || !gym.approved) {
      return NextResponse.json({ error: "Gym must be an approved gym." }, { status: 400 });
    }
  }

  const { data: athlete, error: readErr } = await svc
    .from("registration_athletes")
    .select("id, profile_id")
    .eq("id", athleteId)
    .single();
  if (readErr || !athlete) return NextResponse.json({ error: "Athlete not found." }, { status: 404 });

  const { error: raErr } = await svc
    .from("registration_athletes")
    .update({ gym_name: gymName })
    .eq("id", athleteId);
  if (raErr) return NextResponse.json({ error: raErr.message }, { status: 500 });

  if (athlete.profile_id) {
    await svc.from("profiles").update({ gym_name: gymName }).eq("id", athlete.profile_id);
  }
  return NextResponse.json({ ok: true, gymName });
}
