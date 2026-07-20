// One-off: seeds WOD1 scores for heats 2-4 of the rehearsal division
// directly via DB (Heat 1 was scored live through the judge UI with a
// real offline-queue test — see project memory). Fills out the
// leaderboard for a full end-to-end rehearsal verification.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

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

const divisionId = "df376c2a-86fb-446d-b7f1-a0ea4de05aa6";

const { data: heats } = await svc
  .from("heats")
  .select("id, heat_number")
  .eq("division_id", divisionId)
  .gt("heat_number", 1)
  .order("heat_number");

for (const heat of heats ?? []) {
  const { data: assignments } = await svc
    .from("heat_assignments")
    .select("id, lane_number")
    .eq("heat_id", heat.id)
    .order("lane_number");

  for (const a of assignments ?? []) {
    const timeSeconds = 160 + Math.floor(Math.random() * 90); // 2:40-4:10
    await svc.from("scores").insert({
      heat_assignment_id: a.id,
      workout_id: "WOD1",
      value_raw: { time_seconds: timeSeconds },
      client_submission_id: randomUUID(),
    });
  }
  console.log(`Heat ${heat.heat_number}: seeded ${assignments?.length ?? 0} scores`);
}
