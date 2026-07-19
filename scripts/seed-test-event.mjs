// One-off: seeds a throwaway test event + division for verifying the
// registration -> Yoco checkout flow end-to-end. Safe to re-run
// (upserts by slug). Not meant for production data.
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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: event, error: eventError } = await sb
  .from("events")
  .upsert(
    {
      name: "Wodflow Test Event",
      slug: "wodflow-test-event",
      start_date: "2026-09-01",
      status: "published",
      waiver_text: "By registering you accept the risks of functional fitness competition.",
    },
    { onConflict: "slug" }
  )
  .select("id")
  .single();
if (eventError) throw eventError;
console.log("Event:", event.id);

const { data: existing } = await sb
  .from("divisions")
  .select("id")
  .eq("event_id", event.id)
  .eq("name", "Test Individual")
  .maybeSingle();

let divisionId = existing?.id;
if (!divisionId) {
  const { data: division, error: divError } = await sb
    .from("divisions")
    .insert({
      event_id: event.id,
      name: "Test Individual",
      team_size: 1,
      price_normal: 10,
      lane_count: 6,
      heat_duration_minutes: 6,
      transition_minutes: 2,
      workout_scoring_type: "time",
    })
    .select("id")
    .single();
  if (divError) throw divError;
  divisionId = division.id;
}
console.log("Division:", divisionId);
console.log(`Register at: /register/${event.id}`);
