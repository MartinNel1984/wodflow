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
    // gap = round(winner_points / (entrants - 1)).
    { profileId: "alice", displayName: "Alice", position: 1, entrants: 10, eventName: "Event A", gender: "female" }, // gap round(100/9)=11 -> 100
    { profileId: "bob", displayName: "Bob", position: 2, entrants: 10, eventName: "Event A", gender: "male" }, // -> 89
    { profileId: "alice", displayName: "Alice", position: 3, entrants: 5, eventName: "Event B", gender: "female" }, // gap round(100/4)=25 -> 50
    { profileId: "bob", displayName: "Bob", position: 1, entrants: 5, eventName: "Event B", gender: "male" }, // -> 100
  ];
  const standings = computeSeriesStandings(placements, { method: "gap_formula", winner_points: 100 });
  assertEqual(
    standings,
    [
      {
        profileId: "bob",
        displayName: "Bob",
        totalPoints: 189,
        eventsCounted: 2,
        gender: "male",
        pointsByEvent: { "Event A": 89, "Event B": 100 },
      },
      {
        profileId: "alice",
        displayName: "Alice",
        totalPoints: 150,
        eventsCounted: 2,
        gender: "female",
        pointsByEvent: { "Event A": 100, "Event B": 50 },
      },
    ],
    "points accumulate per profileId across events, ranked by total"
  );
}

// --- An athlete who only did one of two events still counts, just from 1 event ---
{
  const placements: SeriesEventPlacement[] = [
    { profileId: "alice", displayName: "Alice", position: 1, entrants: 2, eventName: "Event A", gender: "female" },
    { profileId: "bob", displayName: "Bob", position: 2, entrants: 2, eventName: "Event A", gender: "male" },
    { profileId: "alice", displayName: "Alice", position: 1, entrants: 2, eventName: "Event B", gender: "female" },
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
  const placements: SeriesEventPlacement[] = [
    { profileId: "alice", displayName: "Alice", position: 1, entrants: 4, eventName: "Event A", gender: "female" },
  ];
  const standings = computeSeriesStandings(placements, { method: "rank_sum" });
  assertEqual(standings[0].totalPoints, 4, "rank_sum series config: 1st of 4 -> 4 points");
}

// --- gender fills in from a later placement if an earlier one lacked it ---
{
  const placements: SeriesEventPlacement[] = [
    { profileId: "alice", displayName: "Alice", position: 1, entrants: 4, eventName: "Untagged event", gender: null },
    { profileId: "alice", displayName: "Alice", position: 2, entrants: 4, eventName: "Event A", gender: "female" },
  ];
  const standings = computeSeriesStandings(placements);
  assertEqual(standings[0].gender, "female", "gender backfills from a later placement that has one");
}

console.log(failures === 0 ? "\nAll series checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures > 0 ? 1 : 0);
