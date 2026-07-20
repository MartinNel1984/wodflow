// One-off: seeds 20 paid athlete registrations for the 20-athlete /
// 4-heat rehearsal (heats/judges/scoring done live through the real
// UI, per the project's real-functional-test standard — see
// scripts/cleanup-rehearsal-20.mts for teardown).
import { readFileSync, writeFileSync } from "node:fs";
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

const { data: event, error: eventError } = await svc
  .from("events")
  .upsert(
    {
      name: "Wodflow Rehearsal Event",
      slug: "wodflow-rehearsal-20",
      start_date: "2026-08-15",
      status: "published",
      waiver_text: "By registering you accept the risks of functional fitness competition.",
    },
    { onConflict: "slug" }
  )
  .select("id")
  .single();
if (eventError) throw eventError;

const { data: division, error: divError } = await svc
  .from("divisions")
  .insert({
    event_id: event!.id,
    name: "Rehearsal RX Individual",
    team_size: 1,
    price_normal: 150,
    lane_count: 5,
    heat_duration_minutes: 8,
    transition_minutes: 3,
    workout_scoring_type: "time",
  })
  .select("id")
  .single();
if (divError) throw divError;

const firstNames = [
  "Amara", "Bianca", "Caleb", "Dumisani", "Elmarie", "Farai", "Given", "Hlengiwe",
  "Ivan", "Jaco", "Kagiso", "Lerato", "Mpho", "Nadia", "Ola", "Precious",
  "Quinton", "Rikus", "Sanele", "Tumi",
];

const registrationIds: string[] = [];
for (let i = 0; i < 20; i++) {
  const name = `${firstNames[i]} Rehearsal`;
  const { data: reg, error: regError } = await svc
    .from("registrations")
    .insert({
      event_id: event!.id,
      division_id: division!.id,
      price_paid: 150,
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      paid_via: "yoco-test-seed",
      yoco_checkout_id: `test-seed-${i + 1}`,
    })
    .select("id")
    .single();
  if (regError) throw regError;
  registrationIds.push(reg!.id);

  const email = `${firstNames[i].toLowerCase()}.rehearsal${i + 1}@example.com`;
  await svc.from("registration_athletes").insert({
    registration_id: reg!.id,
    full_name: name,
    email,
    is_captain: true,
    waiver_signed_name: name,
    waiver_signed_at: new Date().toISOString(),
    waiver_ip: "127.0.0.1",
  });
}

console.log("Event:", event!.id);
console.log("Division:", division!.id);
console.log("Registrations seeded:", registrationIds.length);
console.log(`Organizer heats page: /events/${event!.id}/divisions/${division!.id}/heats`);
console.log(`Public leaderboard: /leaderboard/${division!.id}`);

writeFileSync(
  new URL("../.rehearsal-20-state.json", import.meta.url).pathname,
  JSON.stringify({ eventId: event!.id, divisionId: division!.id, registrationIds }, null, 2)
);
