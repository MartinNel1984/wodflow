// One-off verification for Milestone 9 (schema foundation). Creates
// throwaway test data (prefixed m9-test-, event slugs prefixed
// m9-test-), signs in as each real role, and confirms RLS actually
// allows/denies exactly as designed — not just "the migration ran."
// Cleans up everything it created at the end, pass or fail.
//   node scripts/verify-m9-rls.mts

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnv(new URL("../.env.local", import.meta.url).pathname);

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const svc = createClient(URL_, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  OK   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? " — " + detail : ""}`);
  }
}

async function makeUser(email: string, role: string) {
  const password = `M9test-${Math.random().toString(36).slice(2, 10)}!`;
  const { data: existing } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing.users.find((u) => u.email === email);
  let userId: string;
  if (found) {
    userId = found.id;
    await svc.auth.admin.updateUserById(userId, { password });
  } else {
    const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  }
  await svc.from("profiles").upsert({ id: userId, full_name: role, email, role }, { onConflict: "id" });
  const client = createClient(URL_, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { userId, client };
}

async function main() {
  console.log("Setting up throwaway test data...");

  const organizer = await makeUser("m9-test-organizer@wodflow.local", "organizer");
  const headJudge = await makeUser("m9-test-headjudge@wodflow.local", "head_judge");
  const judge = await makeUser("m9-test-judge@wodflow.local", "judge");
  const athlete = await makeUser("m9-test-athlete@wodflow.local", "athlete");

  // Centralized-mode event + division + heat + heat_assignment + judge_assignment
  const { data: centralEvent } = await svc
    .from("events")
    .upsert(
      { name: "M9 Test Centralized", slug: "m9-test-centralized", start_date: "2026-08-01", judging_mode: "centralized" },
      { onConflict: "slug" }
    )
    .select()
    .single();
  const { data: centralDivision } = await svc
    .from("divisions")
    .insert({ event_id: centralEvent.id, name: "M9 Test Division", price_normal: 0 })
    .select()
    .single();
  const { data: centralReg } = await svc
    .from("registrations")
    .insert({ event_id: centralEvent.id, division_id: centralDivision.id, price_paid: 0, payment_status: "waived" })
    .select()
    .single();
  const { data: centralHeat } = await svc
    .from("heats")
    .insert({
      event_id: centralEvent.id,
      division_id: centralDivision.id,
      heat_number: 1,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 600000).toISOString(),
      status: "in_progress",
    })
    .select()
    .single();
  const { data: centralAssignment } = await svc
    .from("heat_assignments")
    .insert({ heat_id: centralHeat.id, registration_id: centralReg.id, lane_number: 1 })
    .select()
    .single();
  await svc.from("judge_assignments").insert({ profile_id: judge.userId, heat_id: centralHeat.id });

  // Distributed-mode event + same shape
  const { data: distEvent } = await svc
    .from("events")
    .upsert(
      { name: "M9 Test Distributed", slug: "m9-test-distributed", start_date: "2026-08-01", judging_mode: "distributed" },
      { onConflict: "slug" }
    )
    .select()
    .single();
  const { data: distDivision } = await svc
    .from("divisions")
    .insert({ event_id: distEvent.id, name: "M9 Test Division", price_normal: 0 })
    .select()
    .single();
  const { data: distReg } = await svc
    .from("registrations")
    .insert({ event_id: distEvent.id, division_id: distDivision.id, price_paid: 0, payment_status: "waived" })
    .select()
    .single();
  const { data: distHeat } = await svc
    .from("heats")
    .insert({
      event_id: distEvent.id,
      division_id: distDivision.id,
      heat_number: 1,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 600000).toISOString(),
      status: "in_progress",
    })
    .select()
    .single();
  const { data: distAssignment } = await svc
    .from("heat_assignments")
    .insert({ heat_id: distHeat.id, registration_id: distReg.id, lane_number: 1 })
    .select()
    .single();
  await svc.from("judge_assignments").insert({ profile_id: judge.userId, heat_id: distHeat.id });

  console.log("\nRunning checks...\n");

  // 1. Organizer can write brand_kits + workouts
  const { error: bkErr } = await organizer.client
    .from("brand_kits")
    .insert({ name: "M9 Test Kit", color_primary: "#000000" });
  check("organizer can create a brand kit", !bkErr, bkErr?.message);

  const { error: wErr } = await organizer.client
    .from("workouts")
    .insert({ division_id: centralDivision.id, name: "M9 Test WOD", sequence: 1 });
  check("organizer can create a workout", !wErr, wErr?.message);

  // 2. Athlete cannot write brand_kits or workouts
  const { error: athBkErr } = await athlete.client
    .from("brand_kits")
    .insert({ name: "should fail", color_primary: "#fff" });
  check("athlete CANNOT create a brand kit", !!athBkErr);

  const { error: athWErr } = await athlete.client
    .from("workouts")
    .insert({ division_id: centralDivision.id, name: "should fail", sequence: 2 });
  check("athlete CANNOT create a workout", !!athWErr);

  // 3. anon can read brand_kits/workouts (public, no PII)
  const anon = createClient(URL_, ANON_KEY);
  const { error: anonBkErr } = await anon.from("brand_kits").select("id").limit(1);
  check("anon CAN read brand_kits", !anonBkErr, anonBkErr?.message);
  const { error: anonWErr } = await anon.from("workouts").select("id").limit(1);
  check("anon CAN read workouts", !anonWErr, anonWErr?.message);

  // 4. Centralized mode: assigned judge CANNOT insert a score
  const { error: centralJudgeErr } = await judge.client.from("scores").insert({
    heat_assignment_id: centralAssignment.id,
    workout_id: "wod1",
    value_raw: { time_seconds: 300 },
    client_submission_id: crypto.randomUUID(),
  });
  check("centralized mode: assigned judge CANNOT insert a score", !!centralJudgeErr);

  // 5. Centralized mode: head_judge CAN insert a score
  const { error: centralHjErr } = await headJudge.client.from("scores").insert({
    heat_assignment_id: centralAssignment.id,
    workout_id: "wod1",
    value_raw: { time_seconds: 300 },
    client_submission_id: crypto.randomUUID(),
  });
  check("centralized mode: head_judge CAN insert a score", !centralHjErr, centralHjErr?.message);

  // 6. Distributed mode, heat in_progress: assigned judge CAN insert
  const { error: distJudgeOkErr } = await judge.client.from("scores").insert({
    heat_assignment_id: distAssignment.id,
    workout_id: "wod1",
    value_raw: { time_seconds: 280 },
    client_submission_id: crypto.randomUUID(),
  });
  check("distributed mode, in_progress: assigned judge CAN insert", !distJudgeOkErr, distJudgeOkErr?.message);

  // 7. Lock the heat, then the same judge CANNOT insert/correct
  await svc.from("heats").update({ status: "completed" }).eq("id", distHeat.id);
  const { error: distJudgeLockedErr } = await judge.client.from("scores").insert({
    heat_assignment_id: distAssignment.id,
    workout_id: "wod1",
    value_raw: { time_seconds: 270 },
    client_submission_id: crypto.randomUUID(),
  });
  check("distributed mode, LOCKED (completed): judge CANNOT insert", !!distJudgeLockedErr);

  // 8. head_judge CAN still correct after lock
  const { error: distHjLockedErr } = await headJudge.client.from("scores").insert({
    heat_assignment_id: distAssignment.id,
    workout_id: "wod1",
    value_raw: { time_seconds: 265 },
    client_submission_id: crypto.randomUUID(),
  });
  check("distributed mode, LOCKED: head_judge CAN still correct", !distHjLockedErr, distHjLockedErr?.message);

  console.log(`\n${pass} passed, ${fail} failed.\n`);

  console.log("Cleaning up test data...");
  await svc.from("events").delete().in("id", [centralEvent.id, distEvent.id]); // cascades divisions/registrations/heats/etc.
  await svc.from("brand_kits").delete().eq("name", "M9 Test Kit");
  await svc.from("workouts").delete().eq("name", "M9 Test WOD");
  for (const u of [organizer, headJudge, judge, athlete]) {
    await svc.auth.admin.deleteUser(u.userId);
  }
  console.log("Done.");

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
