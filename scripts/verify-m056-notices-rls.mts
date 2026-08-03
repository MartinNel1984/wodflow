// One-off verification for migration-056 (notices RLS). Creates a
// throwaway org/organizer/event/notice, one athlete registered for
// that event, and one athlete NOT registered — confirms the registered
// athlete can read the notice, the unregistered one can't, and the
// organizer can write. Cleans up everything, pass or fail.
//   npx tsx scripts/verify-m056-notices-rls.mts

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

async function makeAthlete(email: string) {
  const password = `M056test-${Math.random().toString(36).slice(2, 10)}!`;
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
  await svc.from("profiles").upsert({ id: userId, full_name: "Verify Athlete", email, role: "athlete" }, { onConflict: "id" });
  const client = createClient(URL_, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  await client.auth.signInWithPassword({ email, password });
  return { userId, client };
}

async function main() {
  const { data: org } = await svc
    .from("organizations")
    .upsert({ name: "M056 Test Org", slug: "m056-test-org", status: "active" }, { onConflict: "slug" })
    .select()
    .single();

  const { data: event } = await svc
    .from("events")
    .upsert(
      { name: "M056 verify event", slug: "m056-verify-event", organization_id: org!.id, status: "draft", start_date: "2026-12-01" },
      { onConflict: "slug" }
    )
    .select()
    .single();

  const { data: division } = await svc
    .from("divisions")
    .insert({ event_id: event!.id, name: "M056 Test Division", team_size: 1, price_normal: 100 })
    .select()
    .single();

  const { data: notice } = await svc
    .from("notices")
    .insert({ event_id: event!.id, organization_id: org!.id, title: "Test notice", body: "Briefing at 8am" })
    .select()
    .single();

  const registered = await makeAthlete("verify-notices-registered@wodflow.local");
  const unregistered = await makeAthlete("verify-notices-unregistered@wodflow.local");

  const { data: registration } = await svc
    .from("registrations")
    .insert({ event_id: event!.id, division_id: division!.id, payment_status: "waived" })
    .select()
    .single();
  await svc.from("registration_athletes").insert({
    registration_id: registration!.id,
    profile_id: registered.userId,
    full_name: "Verify Athlete",
    email: "verify-notices-registered@wodflow.local",
    is_captain: true,
  });

  const { data: seenByRegistered } = await registered.client.from("notices").select("id").eq("id", notice!.id);
  check("Registered athlete CAN see the notice", (seenByRegistered ?? []).length === 1);

  const { data: seenByUnregistered } = await unregistered.client.from("notices").select("id").eq("id", notice!.id);
  check("Unregistered athlete CANNOT see the notice", (seenByUnregistered ?? []).length === 0);

  const { error: athleteWriteErr } = await registered.client
    .from("notices")
    .insert({ event_id: event!.id, organization_id: org!.id, title: "Hack", body: "x" });
  check("Athlete CANNOT post a notice", !!athleteWriteErr);

  console.log("\nCleaning up...");
  await svc.from("registration_athletes").delete().eq("registration_id", registration!.id);
  await svc.from("registrations").delete().eq("id", registration!.id);
  await svc.from("notices").delete().eq("id", notice!.id);
  await svc.from("divisions").delete().eq("id", division!.id);
  await svc.from("events").delete().eq("id", event!.id);
  await svc.from("profiles").delete().in("email", [
    "verify-notices-registered@wodflow.local",
    "verify-notices-unregistered@wodflow.local",
  ]);
  const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of users.users) {
    if (u.email === "verify-notices-registered@wodflow.local" || u.email === "verify-notices-unregistered@wodflow.local") {
      await svc.auth.admin.deleteUser(u.id);
    }
  }
  await svc.from("organizations").delete().eq("id", org!.id);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
