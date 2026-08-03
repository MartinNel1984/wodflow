// One-off verification for migration-050 (event_posters_write RLS fix).
// Creates two throwaway orgs + organizers + one event each (synthetic
// test accounts, not real users), signs in as each, and confirms:
//   - an organizer CAN upload a poster for their own event (this was
//     broken before migration-050 — the bug this migration fixes)
//   - an organizer from a DIFFERENT org still CANNOT upload into
//     another org's event folder (the cross-tenant scoping migration-026
//     was meant to add must still hold after the fix)
// Cleans up everything, pass or fail.
//   npx tsx scripts/verify-m050-event-posters-rls.mts

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

async function makeOrgOrganizerWithEvent(orgName: string, slug: string, email: string) {
  const { data: org, error: orgErr } = await svc
    .from("organizations")
    .upsert({ name: orgName, slug, status: "active" }, { onConflict: "slug" })
    .select()
    .single();
  if (orgErr) throw orgErr;

  const password = `M050test-${Math.random().toString(36).slice(2, 10)}!`;
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
  await svc.from("profiles").upsert(
    { id: userId, full_name: `${orgName} organizer`, email, role: "organizer", organization_id: org.id },
    { onConflict: "id" }
  );

  const { data: event, error: eventErr } = await svc
    .from("events")
    .upsert(
      {
        name: `${orgName} verify event`,
        slug: `${slug}-verify-event`,
        organization_id: org.id,
        status: "draft",
        start_date: "2026-12-01",
      },
      { onConflict: "slug" }
    )
    .select()
    .single();
  if (eventErr) throw eventErr;

  const client = createClient(URL_, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { org, event, userId, client };
}

async function main() {
  console.log("Setting up two throwaway orgs, each with one event...");
  const a = await makeOrgOrganizerWithEvent("M050 Test Org A", "m050-test-org-a", "m050-test-a@wodflow.local");
  const b = await makeOrgOrganizerWithEvent("M050 Test Org B", "m050-test-org-b", "m050-test-b@wodflow.local");

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );

  console.log("\nTesting event-posters bucket...");
  {
    const ownPath = `${a.event.id}/verify-own.png`;
    const { error: ownErr } = await a.client.storage.from("event-posters").upload(ownPath, tinyPng, {
      contentType: "image/png",
      upsert: true,
    });
    check("Organizer CAN upload a poster for their own event (the fix)", !ownErr, ownErr?.message);

    const crossPath = `${b.event.id}/verify-cross.png`;
    const { error: crossErr } = await a.client.storage.from("event-posters").upload(crossPath, tinyPng, {
      contentType: "image/png",
      upsert: true,
    });
    check(
      "Organizer CANNOT upload into a different org's event folder",
      !!crossErr,
      crossErr ? undefined : "upload succeeded — should have been denied"
    );
  }

  if (process.env.SKIP_CLEANUP) {
    console.log("\nSKIP_CLEANUP set — leaving test data in place for debugging.");
    console.log(`orgA=${a.org.id} eventA=${a.event.id} orgB=${b.org.id} eventB=${b.event.id}`);
    console.log(`${pass} passed, ${fail} failed`);
    return;
  }
  console.log("\nCleaning up...");
  await svc.storage.from("event-posters").remove([`${a.event.id}/verify-own.png`, `${b.event.id}/verify-cross.png`]);
  await svc.from("events").delete().in("id", [a.event.id, b.event.id]);
  await svc.from("profiles").delete().in("email", ["m050-test-a@wodflow.local", "m050-test-b@wodflow.local"]);
  const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of users.users) {
    if (u.email === "m050-test-a@wodflow.local" || u.email === "m050-test-b@wodflow.local") {
      await svc.auth.admin.deleteUser(u.id);
    }
  }
  await svc.from("organizations").delete().in("name", ["M050 Test Org A", "M050 Test Org B"]);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
