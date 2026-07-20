// One-off verification: hand-worked edge cases for lib/series.ts.
// Run: npx tsx scripts/test-series.mts
import { computeSeriesStandings, type SeriesEventPlacement } from "../lib/series";

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  actual:   ${a}\n  expected: ${e}`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

// --- Same athlete places across two events, points accumulate ---
{
  const placements: SeriesEventPlacement[] = [
    { profileId: "alice", displayName: "Alice", position: 1, entrants: 10 }, // gap 10 -> 100
    { profileId: "bob", displayName: "Bob", position: 2, entrants: 10 }, // -> 90
    { profileId: "alice", displayName: "Alice", position: 3, entrants: 5 }, // gap 20 -> 60
    { profileId: "bob", displayName: "Bob", position: 1, entrants: 5 }, // -> 100
  ];
  const standings = computeSeriesStandings(placements, { method: "gap_formula", winner_points: 100 });
  assertEqual(
    standings,
    [
      { profileId: "bob", displayName: "Bob", totalPoints: 190, eventsCounted: 2 },
      { profileId: "alice", displayName: "Alice", totalPoints: 160, eventsCounted: 2 },
    ],
    "points accumulate per profileId across events, ranked by total"
  );
}

// --- An athlete who only did one of two events still counts, just from 1 event ---
{
  const placements: SeriesEventPlacement[] = [
    { profileId: "alice", displayName: "Alice", position: 1, entrants: 2 },
    { profileId: "bob", displayName: "Bob", position: 2, entrants: 2 },
    { profileId: "alice", displayName: "Alice", position: 1, entrants: 2 },
  ];
  const standings = computeSeriesStandings(placements);
  assertEqual(
    standings.find((s) => s.profileId === "bob")?.eventsCounted,
    1,
    "athlete who only entered one event has eventsCounted=1, not padded with zeros"
  );
}

// --- rank_sum series config works too, not just gap_formula ---
{
  const placements: SeriesEventPlacement[] = [{ profileId: "alice", displayName: "Alice", position: 1, entrants: 4 }];
  const standings = computeSeriesStandings(placements, { method: "rank_sum" });
  assertEqual(standings[0].totalPoints, 4, "rank_sum series config: 1st of 4 -> 4 points");
}

console.log(failures === 0 ? "\nAll series checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures > 0 ? 1 : 0);
