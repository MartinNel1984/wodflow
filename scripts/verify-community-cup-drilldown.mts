// Live verification of the Community Cup drill-down (Tjokkie, 10-05).
// Hits the live Supabase, calls computeCommunityCupForSeries, dumps the
// top gym's per-event contributions so we can eyeball the math.
// Run: npx tsx scripts/verify-community-cup-drilldown.mts
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { computeCommunityCupForSeries } from "../lib/communityCup";

config({ path: ".env.local" });

const SERIES_ID = "ff985882-8a09-4deb-b98a-18d7a94f3551"; // Rumble 2026

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const result = await computeCommunityCupForSeries(supabase, SERIES_ID);
console.log(
  `Series: enabled=${result.enabled} minAthletes=${result.minAthletes} gyms=${result.gyms.length}`
);

const top = result.gyms.slice(0, 3);
for (const g of top) {
  console.log(`\n=== ${g.gymName} — total ${g.totalPoints} pts, ${g.distinctAthleteCount} athletes ===`);
  for (const [eventName, pts] of Object.entries(g.pointsByEvent)) {
    console.log(`  ${eventName}: ${pts} pts`);
    const contribs = g.contributionsByEvent[eventName] ?? [];
    for (const c of contribs.slice(0, 5)) {
      if (c.kind === "team") {
        const athletes = c.athleteNames.length ? c.athleteNames.join(", ") : "(no names)";
        console.log(
          `    [team] ${c.teamName} — ${c.position}/${c.entrants} · ${athletes} · ${c.seriesPointsForTeam} × ${c.slotsFromThisGym}/${c.teamSize} = ${c.pointsCredited}`
        );
      } else {
        console.log(
          `    [hist] ${c.athleteName} — ${c.position}/${c.entrants} · ${c.pointsCredited} pts`
        );
      }
    }
    if (contribs.length > 5) console.log(`    …and ${contribs.length - 5} more`);
  }
}
