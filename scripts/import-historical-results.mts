// Reusable importer for Rumble Series events run before/outside
// Wodflow (Indy, Big Rumble in Randburg, ...). Takes a normalized JSON
// file (see scripts/README-historical-import.md for shape — produced
// by a one-off spreadsheet->JSON conversion since the source sheets
// arrive in whatever shape the organizer happens to export) and:
//   1. upserts one historical_events row (by org+name) and uploads its
//      logo to the historical-event-logos bucket if not already there
//   2. inserts one historical_results row per athlete row, linked to
//      that event — skips rows that already exist (same event+athlete
//      email+division+position) so re-running on the same file is safe
//
// Usage: npx tsx scripts/import-historical-results.mts <path-to-json>
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

type Row = {
  team_name: string | null;
  athlete_name: string;
  athlete_email: string;
  division_name: string;
  gender: "male" | "female" | null;
  season_tier: number | null;
  position: number;
  entrants: number;
};

type ImportFile = {
  event: { name: string; logoFile: string | null; eventDate: string | null };
  rows: Row[];
};

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("Usage: npx tsx scripts/import-historical-results.mts <path-to-json>");
  process.exit(1);
}
const file: ImportFile = JSON.parse(readFileSync(jsonPath, "utf8"));

// Rumble Series/Tjokkie's org — hardcoded slug rather than "the only
// org that exists" so this script stays correct once the platform has
// more than one tenant.
const { data: org, error: orgError } = await svc.from("organizations").select("id").eq("slug", "atg").single();
if (orgError) throw orgError;
const organizationId = org.id as string;

const { data: existingEvent } = await svc
  .from("historical_events")
  .select("id, logo_path")
  .eq("organization_id", organizationId)
  .eq("name", file.event.name)
  .maybeSingle();

let eventId = existingEvent?.id as string | undefined;
if (!eventId) {
  const { data: created, error: createError } = await svc
    .from("historical_events")
    .insert({ organization_id: organizationId, name: file.event.name, event_date: file.event.eventDate })
    .select("id")
    .single();
  if (createError) throw createError;
  eventId = created.id;
  console.log(`Created historical_events row for "${file.event.name}" (${eventId})`);
} else {
  console.log(`Reusing existing historical_events row for "${file.event.name}" (${eventId})`);
}

if (file.event.logoFile && !existingEvent?.logo_path) {
  const bytes = readFileSync(file.event.logoFile);
  const ext = file.event.logoFile.split(".").pop() || "jpg";
  const path = `${eventId}/logo.${ext}`;
  const { error: uploadError } = await svc.storage
    .from("historical-event-logos")
    .upload(path, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, upsert: true });
  if (uploadError) throw uploadError;
  const { error: updateError } = await svc.from("historical_events").update({ logo_path: path }).eq("id", eventId);
  if (updateError) throw updateError;
  console.log(`Uploaded logo -> ${path}`);
}

const { data: existingResults } = await svc
  .from("historical_results")
  .select("athlete_email, division_name, position")
  .eq("historical_event_id", eventId);
const existingKeys = new Set((existingResults ?? []).map((r) => `${r.athlete_email}::${r.division_name}::${r.position}`));

const toInsert = file.rows
  .filter((r) => !existingKeys.has(`${r.athlete_email}::${r.division_name}::${r.position}`))
  .map((r) => ({
    organization_id: organizationId,
    historical_event_id: eventId,
    event_name: file.event.name,
    division_name: r.division_name,
    team_name: r.team_name,
    athlete_name: r.athlete_name,
    athlete_email: r.athlete_email,
    position: r.position,
    entrants: r.entrants,
    gender: r.gender,
    season_tier: r.season_tier,
  }));

if (toInsert.length === 0) {
  console.log("No new rows to insert (already imported).");
} else {
  const { error: insertError } = await svc.from("historical_results").insert(toInsert);
  if (insertError) throw insertError;
  console.log(`Inserted ${toInsert.length} historical_results rows (skipped ${file.rows.length - toInsert.length} already present).`);
}
