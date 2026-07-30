// One-off verification for migration-039 (storage path-scoping fix on
// hub-photos/brand-kit-logos). Creates two throwaway orgs + organizers,
// signs in as each (synthetic test accounts created by this script, not
// real users), and confirms cross-tenant writes are now denied while
// same-org writes still work. Cleans up everything, pass or fail.
//   npx tsx scripts/verify-m039-storage-scoping.mts

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

async function makeOrgOrganizer(orgName: string, slug: string, email: string) {
  const { data: org, error: orgErr } = await svc
    .from("organizations")
    .upsert({ name: orgName, slug, status: "active" }, { onConflict: "slug" })
    .select()
    .single();
  if (orgErr) throw orgErr;

  const password = `M039test-${Math.random().toString(36).slice(2, 10)}!`;
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
  const client = createClient(URL_, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { org, userId, client };
}

async function main() {
  console.log("Setting up two throwaway orgs...");
  const a = await makeOrgOrganizer("M039 Test Org A", "m039-test-org-a", "m039-test-a@wodflow.local");
  const b = await makeOrgOrganizer("M039 Test Org B", "m039-test-org-b", "m039-test-b@wodflow.local");

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );

  console.log("\nTesting hub-photos bucket...");
  {
    const ownPath = `${a.org.id}/verify-own.png`;
    const { error: ownErr } = await a.client.storage.from("hub-photos").upload(ownPath, tinyPng, {
      contentType: "image/png",
      upsert: true,
    });
    check("Org A can write into its own org folder", !ownErr, ownErr?.message);

    const crossPath = `${b.org.id}/verify-cross.png`;
    const { error: crossErr } = await a.client.storage.from("hub-photos").upload(crossPath, tinyPng, {
      contentType: "image/png",
      upsert: true,
    });
    check("Org A CANNOT write into Org B's org folder", !!crossErr, crossErr ? undefined : "upload succeeded — should have been denied");

    // Seed one real object as Org B, then try to overwrite/delete it as Org A.
    await b.client.storage.from("hub-photos").upload(`${b.org.id}/verify-seed.png`, tinyPng, {
      contentType: "image/png",
      upsert: true,
    });
    const { error: overwriteErr } = await a.client.storage
      .from("hub-photos")
      .upload(`${b.org.id}/verify-seed.png`, tinyPng, { contentType: "image/png", upsert: true });
    check(
      "Org A CANNOT overwrite Org B's existing photo",
      !!overwriteErr,
      overwriteErr ? undefined : "overwrite succeeded — should have been denied"
    );

    const { error: deleteErr, data: deleteData } = await a.client.storage
      .from("hub-photos")
      .remove([`${b.org.id}/verify-seed.png`]);
    const actuallyDeleted = (deleteData ?? []).length > 0;
    check(
      "Org A CANNOT delete Org B's existing photo",
      !actuallyDeleted,
      actuallyDeleted ? "delete call reported success on Org B's object" : deleteErr?.message
    );
  }

  console.log("\nTesting brand-kit-logos bucket...");
  {
    const ownPath = `${a.org.id}/verify-own.png`;
    const { error: ownErr } = await a.client.storage.from("brand-kit-logos").upload(ownPath, tinyPng, {
      contentType: "image/png",
      upsert: true,
    });
    check("Org A can write into its own org folder", !ownErr, ownErr?.message);

    const crossPath = `${b.org.id}/verify-cross.png`;
    const { error: crossErr } = await a.client.storage.from("brand-kit-logos").upload(crossPath, tinyPng, {
      contentType: "image/png",
      upsert: true,
    });
    check("Org A CANNOT write into Org B's org folder", !!crossErr, crossErr ? undefined : "upload succeeded — should have been denied");
  }

  if (process.env.SKIP_CLEANUP) {
    console.log("\nSKIP_CLEANUP set — leaving test data in place for debugging.");
    console.log(`orgA=${a.org.id} orgB=${b.org.id}`);
    console.log(`${pass} passed, ${fail} failed`);
    return;
  }
  console.log("\nCleaning up...");
  await svc.storage.from("hub-photos").remove([
    `${a.org.id}/verify-own.png`,
    `${b.org.id}/verify-cross.png`,
    `${b.org.id}/verify-seed.png`,
  ]);
  await svc.storage.from("brand-kit-logos").remove([`${a.org.id}/verify-own.png`, `${b.org.id}/verify-cross.png`]);
  await svc.from("profiles").delete().in("email", ["m039-test-a@wodflow.local", "m039-test-b@wodflow.local"]);
  const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of users.users) {
    if (u.email === "m039-test-a@wodflow.local" || u.email === "m039-test-b@wodflow.local") {
      await svc.auth.admin.deleteUser(u.id);
    }
  }
  await svc.from("organizations").delete().in("name", ["M039 Test Org A", "M039 Test Org B"]);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
