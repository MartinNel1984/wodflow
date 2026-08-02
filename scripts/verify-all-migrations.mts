// Audit: is every migration actually applied to the live database?
//
// Probes for the concrete artifact each migration is supposed to create
// — every table, view, added column, and function extracted from the
// files in supabase/ — rather than trusting that they were all run. A
// migration that was written but never pasted into the SQL Editor is
// invisible until something breaks at an event.
//   npx tsx scripts/verify-all-migrations.mts

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

// table/view -> migration that introduced it
const RELATIONS: Record<string, string> = {
  events: "schema", profiles: "schema", divisions: "schema", registrations: "schema",
  registration_athletes: "schema", heats: "schema", heat_assignments: "schema",
  judge_assignments: "schema", scores: "schema",
  latest_scores: "schema / m034",
  public_heat_sheet: "m001 / m023",
  public_leaderboard: "m004 / m019 / m030 / m040 / m042",
  brand_kits: "m007",
  workouts: "m008", workout_movements: "m008",
  team_invites: "m011",
  series: "m012", series_events: "m012",
  signup_attempts: "m020",
  organizations: "m026", org_invites: "m026",
  hub_photos: "m036",
  event_tickets: "m044",
};

// "table.column" -> migration
const COLUMNS: Record<string, string> = {
  "events.default_price": "m005", "events.brand_kit_id": "m007", "events.judging_mode": "m006",
  "events.description": "m022", "events.poster_url": "m022", "events.organization_id": "m026",
  "events.spectator_price": "m044",
  "events.spectator_capacity": "m046", "events.max_tickets_per_order": "m046",
  "divisions.scoring_config": "m013", "divisions.max_entries": "m031",
  "heats.workout_id": "m021",
  "profiles.id_number": "m017", "profiles.organization_id": "m026",
  "registration_athletes.id_number": "m010", "registration_athletes.is_minor": "m010",
  "registration_athletes.guardian_name": "m010", "registration_athletes.guardian_id_number": "m010",
  "registration_athletes.waiver_text_snapshot": "m010",
  "registrations.payfast_payment_id": "m025",
  "scores.rx_or_scaled": "m009", "scores.tiebreak_value": "m009",
  "scores.workout_ref_id": "m008", "scores.workout_scoring_config_snapshot": "m040",
  "series.organization_id": "m026",
  "team_invites.registration_athlete_id": "m018",
  "workouts.lane_count": "m024", "workouts.heat_duration_minutes": "m024",
  "workouts.transition_minutes": "m024", "workouts.scoring_config": "m029",
  "workout_movements.reps": "m028", "workout_movements.load": "m028/m038",
  "brand_kits.organization_id": "m026",
};

// function -> { migration, sample args } — probed via RPC.
const FUNCTIONS: Record<string, { mig: string; args: Record<string, unknown> }> = {
  is_platform_admin: { mig: "m026", args: {} },
  my_organization_id: { mig: "m026", args: {} },
  my_role: { mig: "m027", args: {} },
  is_organizer: { mig: "rls-policies", args: {} },
  is_judge: { mig: "rls-policies", args: {} },
  is_head_judge: { mig: "m006", args: {} },
  my_assigned_heat_ids: { mig: "rls-policies", args: {} },
  my_registration_ids: { mig: "rls-policies", args: {} },
  is_privileged_for: { mig: "m026", args: { org_id: "00000000-0000-0000-0000-000000000000" } },
  is_organizer_for: { mig: "m026", args: { org_id: "00000000-0000-0000-0000-000000000000" } },
  heat_judging_mode: { mig: "m015", args: { p_heat_id: "00000000-0000-0000-0000-000000000000" } },
  score_value_is_sane: { mig: "m045", args: { v: { reps: 1 } } },
};

// Triggers can't be probed directly through PostgREST — assert their
// observable behaviour instead.
const missing: string[] = [];
let checked = 0;

async function main() {
  console.log("\n=== Tables & views ===\n");
  for (const [rel, mig] of Object.entries(RELATIONS)) {
    checked++;
    const { error } = await svc.from(rel).select("*").limit(0);
    if (error) {
      missing.push(`RELATION ${rel} (${mig}) — ${error.message}`);
      console.log(`  MISSING  ${rel.padEnd(24)} [${mig}]`);
    } else {
      console.log(`  ok       ${rel.padEnd(24)} [${mig}]`);
    }
  }

  console.log("\n=== Added columns ===\n");
  for (const [key, mig] of Object.entries(COLUMNS)) {
    checked++;
    const [table, col] = key.split(".");
    const { error } = await svc.from(table).select(col).limit(0);
    if (error) {
      missing.push(`COLUMN ${key} (${mig}) — ${error.message}`);
      console.log(`  MISSING  ${key.padEnd(46)} [${mig}]`);
    } else {
      console.log(`  ok       ${key.padEnd(46)} [${mig}]`);
    }
  }

  console.log("\n=== Functions ===\n");
  for (const [fn, { mig, args }] of Object.entries(FUNCTIONS)) {
    checked++;
    const { error } = await svc.rpc(fn, args);
    // A function that exists but rejects our sample args still proves it
    // was created; only "could not find the function" means missing.
    const notFound = error && /could not find the function|does not exist/i.test(error.message);
    if (notFound) {
      missing.push(`FUNCTION ${fn}() (${mig}) — ${error.message}`);
      console.log(`  MISSING  ${fn.padEnd(24)} [${mig}]`);
    } else {
      console.log(`  ok       ${fn.padEnd(24)} [${mig}]`);
    }
  }

  console.log("\n=== Removals (a migration that DROPs something) ===\n");
  // m043 removed Yoco entirely, including events.payment_provider. Its
  // absence is the correct state — checking for it is how we confirm
  // that migration ran, the mirror image of a column-present check.
  checked++;
  const { error: ppErr } = await svc.from("events").select("payment_provider").limit(0);
  const dropped = !!ppErr && /payment_provider/.test(ppErr.message);
  console.log(`  ${dropped ? "ok      " : "NOT RUN "} events.payment_provider is gone      [m043 remove-yoco]`);
  if (!dropped) missing.push("m043 did not drop events.payment_provider");

  console.log("\n=== Trigger behaviour (can't be introspected — tested by effect) ===\n");
  // m033: division max_entries. m046 verified separately in
  // verify-m045-m046.mts; m045's constraint likewise.
  const { error: sane } = await svc.rpc("score_value_is_sane", { v: { time_seconds: -1 } });
  const saneOk = !sane;
  console.log(`  ${saneOk ? "ok      " : "MISSING "} score_value_is_sane responds  [m045]`);
  if (!saneOk) missing.push("m045 score_value_is_sane not callable");

  console.log("\n" + "=".repeat(60));
  if (missing.length === 0) {
    console.log(`\nAll ${checked} database objects present. No migration appears to be missing.\n`);
  } else {
    console.log(`\n${missing.length} MISSING of ${checked} checked:\n`);
    for (const m of missing) console.log("  - " + m);
    console.log("");
  }
  process.exit(missing.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
