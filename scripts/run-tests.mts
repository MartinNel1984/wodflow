// Runs every pure (no-database) test suite in this directory.
//
// Auto-discovers scripts/test-*.mts rather than listing them, so adding a
// new suite wires it into CI automatically — a hardcoded list is one
// someone eventually forgets to update, which is how a test quietly stops
// running without anyone noticing.
//
// Only test-*.mts are run here. The verify-*.mts scripts talk to the live
// Supabase database and need real credentials, so they stay manual /
// pre-event (see scripts/verify-all-migrations.mts).
//
//   npm test

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(here)
  .filter((f) => f.startsWith("test-") && f.endsWith(".mts"))
  .sort();

if (suites.length === 0) {
  console.error("No test-*.mts suites found — that itself is a problem.");
  process.exit(1);
}

console.log(`\nRunning ${suites.length} test suites\n${"=".repeat(50)}`);

const failed: string[] = [];

for (const suite of suites) {
  console.log(`\n--- ${suite} ---`);
  const result = spawnSync("npx", ["tsx", join(here, suite)], {
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) failed.push(suite);
}

console.log(`\n${"=".repeat(50)}`);
if (failed.length === 0) {
  console.log(`\nAll ${suites.length} suites passed.\n`);
  process.exit(0);
}
console.log(`\n${failed.length} of ${suites.length} suites FAILED:\n`);
for (const f of failed) console.log(`  - ${f}`);
console.log("");
process.exit(1);
