// One-off: seeds a test event/division/heat/registration + a real
// judge account (with a KNOWN pin) for browser-driven offline-queue
// testing. Prints the judge name + PIN to use in the UI. Run
// scripts/cleanup-offline-test.mts afterward.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { deriveJudgePassword } from "../lib/judges";

function loadEnv(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnv(new URL("../.env.local", import.meta.url).pathname);

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: event } = await svc
  .from("events")
  .upsert({ name: "Offline Test Event", slug: "wodflow-offline-test", start_date: "2026-09-01", status: "published" }, { onConflict: "slug" })
  .select("id")
  .single();
const { data: division } = await svc
  .from("divisions")
  .insert({ event_id: event!.id, name: "Offline Test Division", team_size: 1, price_normal: 10, lane_count: 2, workout_scoring_type: "time" })
  .select("id")
  .single();
const { data: heat } = await svc
  .from("heats")
  .insert({ event_id: event!.id, division_id: division!.id, heat_number: 1, start_time: new Date().toISOString(), end_time: new Date().toISOString() })
  .select("id")
  .single();

for (const name of ["Offline Athlete A", "Offline Athlete B"]) {
  const { data: reg } = await svc
    .from("registrations")
    .insert({ event_id: event!.id, division_id: division!.id, payment_status: "paid" })
    .select("id")
    .single();
  await svc.from("registration_athletes").insert({ registration_id: reg!.id, full_name: name, email: `${name.replace(/\s+/g, "").toLowerCase()}@example.com`, is_captain: true });
  const lane = name.endsWith("A") ? 1 : 2;
  await svc.from("heat_assignments").insert({ heat_id: heat!.id, registration_id: reg!.id, lane_number: lane });
}

const judgeEmail = `judge-offline-test@judges.wodflow.local`;
const pin = "9999";
const fullName = "Offline Test Judge";
let judgeId: string;
const { data: existingUsers } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
const existing = existingUsers.users.find((u) => u.email === judgeEmail);
if (existing) {
  judgeId = existing.id;
} else {
  const { data: created } = await svc.auth.admin.createUser({ email: judgeEmail, email_confirm: true, password: `tmp-${crypto.randomUUID()}` });
  judgeId = created!.user!.id;
}
const derivedPassword = await deriveJudgePassword(process.env.PIN_LOGIN_SECRET!, judgeId);
await svc.auth.admin.updateUserById(judgeId, { password: derivedPassword });
await svc.from("profiles").upsert({ id: judgeId, full_name: fullName, email: judgeEmail, role: "judge" });
await svc.rpc("set_user_pin", { p_profile: judgeId, p_pin: pin });
await svc.from("judge_assignments").upsert({ profile_id: judgeId, heat_id: heat!.id }, { onConflict: "profile_id,heat_id" });

console.log("Judge name:", fullName);
console.log("Judge PIN:", pin);
console.log("Heat ID:", heat!.id);
console.log("Event ID (for cleanup):", event!.id);

writeFileSync(
  new URL("../.offline-test-state.json", import.meta.url).pathname,
  JSON.stringify({ eventId: event!.id, judgeId, heatId: heat!.id }, null, 2)
);
