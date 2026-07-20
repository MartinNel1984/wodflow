// One-off: creates a throwaway organizer login for the 20-athlete
// rehearsal, so the UI can be driven without touching Martin's real
// organizer credentials. Delete via cleanup-rehearsal-20.mts.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnv(new URL("../.env.local", import.meta.url).pathname);

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = "rehearsal-organizer@wodflow.local";
const password = `Rehearsal-${Math.random().toString(36).slice(2, 10)}!`;

const { data: existingUsers } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
const existing = existingUsers.users.find((u) => u.email === email);

let userId;
if (existing) {
  userId = existing.id;
  await svc.auth.admin.updateUserById(userId, { password });
} else {
  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userId = created.user.id;
}

await svc.from("profiles").upsert({ id: userId, full_name: "Rehearsal Organizer", email, role: "organizer" });

console.log("Email:", email);
console.log("Password:", password);
console.log("User ID:", userId);
