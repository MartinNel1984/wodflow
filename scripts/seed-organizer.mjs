// One-off seed: creates the single organizer account for Phase 1.
// Run AFTER applying supabase/schema.sql, judge-pin-login.sql, rls-policies.sql.
//   node scripts/seed-organizer.mjs --email=you@example.com --password=...
//
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from .env.local
// (or the environment). Idempotent — safe to re-run; updates the password
// if the account already exists rather than erroring.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnv(new URL("../.env.local", import.meta.url).pathname);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.join("=")];
  })
);

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = args.email;
const password = args.password;

if (!URL_ || !SERVICE_KEY) {
  console.error("Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!email || !password) {
  console.error("Usage: node scripts/seed-organizer.mjs --email=you@example.com --password=...");
  process.exit(1);
}

const sb = createClient(URL_, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUserByEmail(targetEmail) {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase()) ?? null;
}

async function main() {
  let user = await findUserByEmail(email);

  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created organizer account: ${email}`);
  } else {
    const { error } = await sb.auth.admin.updateUserById(user.id, { password });
    if (error) throw error;
    console.log(`Updated password for existing organizer account: ${email}`);
  }

  const { error: profileError } = await sb
    .from("profiles")
    .upsert({ id: user.id, full_name: "Organizer", email, role: "organizer" }, { onConflict: "id" });
  if (profileError) throw profileError;

  console.log("Organizer profile set. Sign in at /login.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
