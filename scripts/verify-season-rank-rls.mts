// Throwaway check: does computeSeriesStandingsForEvents actually see
// every competitor when run as a real (non-organizer) athlete session,
// or only the caller's own registration (because `registrations` RLS
// only allows is_organizer() OR "my own registration ids")?
// Creates a synthetic athlete, signs in as them, and runs the exact
// query computeSeriesStandingsForEvents does against `registrations`
// for a registration NOT belonging to them.
//   npx tsx scripts/verify-season-rank-rls.mts

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

async function main() {
  // Find any registration in the DB that isn't ours (real data, e.g. the
  // real "RX Test" division rehearsal registrations).
  const { data: someRegistration } = await svc.from("registrations").select("id").limit(1).single();
  if (!someRegistration) {
    console.log("No registrations exist to test against.");
    return;
  }

  const email = "verify-season-rank@wodflow.local";
  const password = `verify-${Math.random().toString(36).slice(2, 10)}!`;
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
    { id: userId, full_name: "Verify Athlete", email, role: "athlete" },
    { onConflict: "id" }
  );

  const athleteClient = createClient(URL_, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await athleteClient.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const { data: asAthlete, error: asAthleteErr } = await athleteClient
    .from("registrations")
    .select("id, captain_profile_id")
    .eq("id", someRegistration.id);

  console.log(`Registration ${someRegistration.id} (not owned by the test athlete):`);
  console.log(`  As athlete session: ${asAthlete?.length ?? 0} row(s) returned`, asAthleteErr?.message ?? "");
  console.log(
    asAthlete && asAthlete.length > 0
      ? "  => BUG NOT PRESENT (or this registration happens to be visible some other way)"
      : "  => CONFIRMS BUG: an athlete's own session cannot see other athletes' registrations, so computeSeriesStandingsForEvents silently drops everyone but the caller when run from a real athlete portal session."
  );

  if (!process.env.SKIP_CLEANUP) {
    await svc.from("profiles").delete().eq("id", userId);
    await svc.auth.admin.deleteUser(userId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
