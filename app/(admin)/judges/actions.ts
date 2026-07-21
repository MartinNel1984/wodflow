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
  await requireOrganizer();
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
    .upsert({ id: created.user.id, full_name: fullName, email, role }, { onConflict: "id" });
  if (profileError) throw profileError;

  const { error: pinError } = await svc.rpc("set_user_pin", { p_profile: created.user.id, p_pin: pin });
  if (pinError) throw pinError;

  revalidatePath("/judges");
}

export async function assignJudgeToHeat(formData: FormData) {
  await requireOrganizer();
  const profileId = String(formData.get("profileId") ?? "");
  const heatId = String(formData.get("heatId") ?? "");
  if (!profileId || !heatId) return;

  const svc = createServiceClient();
  const { error } = await svc
    .from("judge_assignments")
    .upsert({ profile_id: profileId, heat_id: heatId }, { onConflict: "profile_id,heat_id" });
  if (error) throw error;

  revalidatePath("/judges");
}
