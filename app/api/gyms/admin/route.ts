import { requireOrganizer } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/gyms/admin — every gym (approved + pending), for the
// organiser's /gyms management page.
export async function GET() {
  try {
    await requireOrganizer();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorised." }, { status: 403 });
  }
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("gyms")
    .select("id, name, approved, created_at")
    .order("approved", { ascending: true })
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gyms: data ?? [] });
}

// PATCH /api/gyms/admin { id, name?, approved? } — approve a pending
// gym, rename a gym, or both. Renames cascade: all profiles and
// registration_athletes rows whose gym_name matches the old name get
// updated to the new name so leaderboards stay consistent.
export async function PATCH(request: Request) {
  try {
    await requireOrganizer();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorised." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  const nameRaw = body?.name as string | undefined;
  const name = typeof nameRaw === "string" ? nameRaw.trim().replace(/\s+/g, " ") : undefined;
  if (name !== undefined && (!name || name.length > 120)) {
    return NextResponse.json({ error: "Invalid gym name." }, { status: 400 });
  }
  const approved = typeof body?.approved === "boolean" ? body.approved : undefined;

  const svc = createServiceClient();
  const { data: before, error: readErr } = await svc
    .from("gyms")
    .select("id, name")
    .eq("id", id)
    .single();
  if (readErr || !before) return NextResponse.json({ error: "Gym not found." }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (approved !== undefined) updates.approved = approved;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: updated, error } = await svc
    .from("gyms")
    .update(updates)
    .eq("id", id)
    .select("id, name, approved")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Rename cascade on athlete rows.
  if (name !== undefined && name !== before.name) {
    await svc.from("profiles").update({ gym_name: name }).eq("gym_name", before.name);
    await svc.from("registration_athletes").update({ gym_name: name }).eq("gym_name", before.name);
  }

  return NextResponse.json({ gym: updated });
}

// DELETE /api/gyms/admin?id=… — remove a gym from the list. Clears the
// cached gym_name on any athlete rows pointing to it so they fall back
// to blank and the organiser can reassign.
export async function DELETE(request: Request) {
  try {
    await requireOrganizer();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorised." }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const svc = createServiceClient();
  const { data: before } = await svc.from("gyms").select("name").eq("id", id).single();
  const { error } = await svc.from("gyms").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (before?.name) {
    await svc.from("profiles").update({ gym_name: null }).eq("gym_name", before.name);
    await svc.from("registration_athletes").update({ gym_name: null }).eq("gym_name", before.name);
  }
  return NextResponse.json({ ok: true });
}
