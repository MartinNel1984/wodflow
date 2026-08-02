// Unit test for lib/scoreValidation.ts — the guard that stops a
// malformed or hostile score reaching the leaderboard.
//   npx tsx scripts/test-score-validation.mts

import { validateScoreValue, validateTiebreakValue } from "../lib/scoreValidation";

let pass = 0;
let fail = 0;

function expectValid(label: string, value: unknown) {
  const result = validateScoreValue(value);
  if (result === null) {
    pass++;
    console.log(`  OK   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label} — expected valid, got: ${result}`);
  }
}

function expectInvalid(label: string, value: unknown) {
  const result = validateScoreValue(value);
  if (result !== null) {
    pass++;
    console.log(`  OK   ${label} — rejected: ${result}`);
  } else {
    fail++;
    console.log(`  FAIL ${label} — expected rejection, got valid`);
  }
}

console.log("\nValid scores:\n");
expectValid("a normal finish time", { time_seconds: 272 });
expectValid("zero seconds (instant, implausible but not corrupt)", { time_seconds: 0 });
expectValid("capped athlete recorded as reps", { reps: 142 });
expectValid("zero reps", { reps: 0 });
expectValid("a load in kg", { load_kg: 102.5 });
expectValid("a no-rep with no measurement", { no_rep: true });
expectValid("time plus an explicit no_rep false", { time_seconds: 300, no_rep: false });

console.log("\nThe bug this exists to stop:\n");
expectInvalid("NEGATIVE time (would sort first on the leaderboard)", { time_seconds: -500 });
expectInvalid("negative reps", { reps: -10 });
expectInvalid("negative load", { load_kg: -50 });

console.log("\nMalformed / corrupt payloads:\n");
expectInvalid("empty object", {});
expectInvalid("null", null);
expectInvalid("an array", [1, 2, 3]);
expectInvalid("a bare string", "12:09");
expectInvalid("time as a string", { time_seconds: "272" });
expectInvalid("NaN time", { time_seconds: NaN });
expectInvalid("Infinity time", { time_seconds: Infinity });
expectInvalid("fractional reps", { reps: 12.5 });
expectInvalid("unrecognised field", { time_seconds: 272, injected: "x" });
expectInvalid("only no_rep:false, measures nothing", { no_rep: false });
expectInvalid("no_rep as a string", { no_rep: "yes" });
expectInvalid("absurdly large time (overflow guard)", { time_seconds: 999_999_999 });
expectInvalid("absurdly large reps", { reps: 5_000_000 });

console.log("\nTiebreaks:\n");
if (validateTiebreakValue(null) === null) {
  pass++;
  console.log("  OK   null tiebreak is allowed");
} else {
  fail++;
  console.log("  FAIL null tiebreak should be allowed");
}
if (validateTiebreakValue({ time_seconds: -1 }) !== null) {
  pass++;
  console.log("  OK   negative tiebreak rejected");
} else {
  fail++;
  console.log("  FAIL negative tiebreak should be rejected");
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
process.exit(fail > 0 ? 1 : 0);
