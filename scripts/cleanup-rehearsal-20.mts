// Tears down all data created for the 20-athlete rehearsal: the
// event (cascades divisions/registrations/heats/assignments/scores),
// the throwaway organizer login, and the rehearsal judge accounts.
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

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: eventError } = await svc.from("events").delete().eq("slug", "wodflow-rehearsal-20");
if (eventError) throw eventError;
console.log("Deleted rehearsal event (cascaded divisions/registrations/heats/assignments/scores)");

const { data: judgeProfiles } = await svc
  .from("profiles")
  .select("id, full_name")
  .in("full_name", ["Rehearsal Judge", "Rehearsal Judge Two"]);

for (const p of judgeProfiles ?? []) {
  const { error } = await svc.auth.admin.deleteUser(p.id);
  if (error) throw error;
  console.log("Deleted judge account:", p.full_name);
}

const { data: existingUsers } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
const organizer = existingUsers.users.find((u) => u.email === "rehearsal-organizer@wodflow.local");
if (organizer) {
  const { error } = await svc.auth.admin.deleteUser(organizer.id);
  if (error) throw error;
  console.log("Deleted throwaway rehearsal organizer account");
}

console.log("Cleanup complete.");
