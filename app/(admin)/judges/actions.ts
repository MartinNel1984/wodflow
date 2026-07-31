"use server";

import { requireOrganizer } from "@/lib/auth";

import { createServiceClient } from "@/lib/supabase/service";
import { deriveJudgePassword } from "@/lib/judges";
import { revalidatePath } from "next/cache";

// Judges don't need a real email — they only ever sign in via PIN —
// but Supabase auth requires one, so we mint a stable placeholder from
// their name. Organizer can override with a real email if they have one.
function placeholderEmail(fullName: string) {
  const slug = fullName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
  return `judge-${slug}-${Date.now()}@judges.wodflow.local`;
}

export async function createJudge(formData: FormData) {
  const { organizationId } = await requireOrganizer();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || placeholderEmail(fullName);
  const role = formData.get("isHeadJudge") === "on" ? "head_judge" : "judge";
  if (!fullName || !/^\d{4}$/.test(pin)) return;

  const svc = createServiceClient();
  const { data: created, error: createError } = await svc.auth.admin.createUser({
    email,
    email_confirm: true,
    password: `tmp-${crypto.randomUUID()}`,
  });
  if (createError || !created.user) throw createError ?? new Error("Could not create judge account");

  // Set the real auth password to the same deterministic, id-derived
  // value the pin-login route will compute — this is what actually
  // lets PIN verification mint a real session (see lib/judges.ts).
  const secret = process.env.PIN_LOGIN_SECRET;
  if (!secret) throw new Error("PIN_LOGIN_SECRET is not set");
  const derivedPassword = await deriveJudgePassword(secret, created.user.id);
  const { error: pwError } = await svc.auth.admin.updateUserById(created.user.id, {
    password: derivedPassword,
  });
  if (pwError) throw pwError;

  const { error: profileError } = await svc
    .from("profiles")
    .upsert(
      { id: created.user.id, full_name: fullName, email, role, organization_id: organizationId },
      { onConflict: "id" },
    );
  if (profileError) throw profileError;

  const { error: pinError } = await svc.rpc("set_user_pin", { p_profile: created.user.id, p_pin: pin });
  if (pinError) throw pinError;

  revalidatePath("/judges");
}

export async function assignJudgeToHeat(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const profileId = String(formData.get("profileId") ?? "");
  const heatId = String(formData.get("heatId") ?? "");
  if (!profileId || !heatId) return;

  // The judge being assigned must be this organizer's own judge — RLS on
  // judge_assignments_write only checks the HEAT's org (via heats ->
  // events), not the profile being assigned, so a foreign/arbitrary
  // profileId would otherwise slip through even on the session client.
  const { data: judgeProfile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", profileId)
    .single();
  if (judgeProfile?.organization_id !== organizationId) return;

  // Session-scoped client (not the service-role client used before) so
  // judge_assignments_write RLS — which verifies the heat belongs to an
  // event in the caller's own org — actually runs. The previous
  // service-role client bypassed RLS entirely, letting any organizer
  // assign a judge to another organization's heat by just knowing its
  // id (heat ids are guessable off the public heat sheet).
  const { error } = await supabase
    .from("judge_assignments")
    .upsert({ profile_id: profileId, heat_id: heatId }, { onConflict: "profile_id,heat_id" });
  if (error) throw error;

  revalidatePath("/judges");
}
