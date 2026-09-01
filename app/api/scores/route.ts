import { createClient } from "@/lib/supabase/server";
import { validateScoreValue, validateTiebreakValue } from "@/lib/scoreValidation";
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

  // Reject implausible/malformed values before they reach the DB — an
  // unvalidated negative time would sort first on the leaderboard.
  // 400 (not 403) so the offline queue treats it as a permanent failure
  // to drop rather than a transient one to retry forever.
  const valueError = validateScoreValue(valueRaw);
  if (valueError) {
    return NextResponse.json({ error: valueError }, { status: 400 });
  }
  const tiebreakError = validateTiebreakValue(tiebreakValue);
  if (tiebreakError) {
    return NextResponse.json({ error: `Tiebreak: ${tiebreakError}` }, { status: 400 });
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
    // Postgres 23503 = foreign key violation, e.g. heat_assignment_id
    // no longer exists because heats were regenerated after this page
    // loaded — a genuinely different failure from "not allowed to
    // score this heat" (RLS, code 42501) but both used to collapse
    // into the same generic 403, leaving a judge with a "Failed" button
    // and zero way to tell "reload the page" apart from "ask the
    // organizer" (Tjokkie, 2026-09-01: unexplained recurring failure).
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "This heat's roster has changed since you loaded it — refresh the page and try again." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
