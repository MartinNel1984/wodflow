import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Uses the session-scoped client, not the service client — RLS
// (scores_insert_judge) is the real enforcement that a judge can only
// submit for heats they're assigned to; this route doesn't re-check
// that itself. Upsert on the (heat_assignment_id, workout_id,
// client_submission_id) unique constraint makes retries idempotent,
// which is what Milestone 5's offline queue relies on.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const heatAssignmentId = body?.heatAssignmentId as string | undefined;
  const workoutId = body?.workoutId as string | undefined;
  const workoutRefId = (body?.workoutRefId as string | null | undefined) ?? null;
  const rxOrScaled = (body?.rxOrScaled as "rx" | "scaled" | null | undefined) ?? null;
  const tiebreakValue = (body?.tiebreakValue as Record<string, unknown> | null | undefined) ?? null;
  const valueRaw = body?.valueRaw as Record<string, unknown> | undefined;
  const clientSubmissionId = body?.clientSubmissionId as string | undefined;

  if (!heatAssignmentId || !workoutId || !valueRaw || !clientSubmissionId) {
    return NextResponse.json({ error: "Missing required score fields." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { error } = await supabase.from("scores").upsert(
    {
      heat_assignment_id: heatAssignmentId,
      workout_id: workoutId,
      workout_ref_id: workoutRefId,
      rx_or_scaled: rxOrScaled,
      tiebreak_value: tiebreakValue,
      value_raw: valueRaw,
      submitted_by: user.id,
      client_submission_id: clientSubmissionId,
    },
    { onConflict: "heat_assignment_id,workout_id,client_submission_id", ignoreDuplicates: true }
  );

  if (error) {
    // RLS violation surfaces here as a plain error (not a 403) — a
    // judge submitting for a heat they're not assigned to lands here.
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
