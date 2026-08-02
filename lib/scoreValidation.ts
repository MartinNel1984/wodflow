// Server-side validation for the score `value_raw` payload.
//
// Both write paths (the judge/offline-queue POST to /api/scores and the
// organizer's correctScore server action) funnel through here, so there
// is exactly one definition of "is this a plausible score" — a second
// copy that drifted would be a data-integrity bug, not a style one.
//
// This exists because /api/scores previously accepted `value_raw` as
// arbitrary JSON and wrote it straight to the DB. `parseTime()` guards
// the UI, but it isn't on the API path at all, so a malformed
// offline-queue replay (or a crafted request from an authenticated
// judge) could store e.g. { time_seconds: -500 } — which sorts *first*
// on the leaderboard, since finishers rank by time ascending.

// Generous upper bounds — these are sanity rails to catch corruption and
// typos, not an attempt to encode real-world plausibility. A 24h cap is
// far beyond any WOD but still rejects overflow/garbage.
const MAX_TIME_SECONDS = 86_400; // 24h
const MAX_REPS = 100_000;
const MAX_LOAD_KG = 1_000;

const ALLOWED_KEYS = new Set(["time_seconds", "reps", "load_kg", "no_rep"]);

export type ScoreValue = {
  time_seconds?: number;
  reps?: number;
  load_kg?: number;
  no_rep?: boolean;
};

function checkNumber(value: unknown, max: number, label: string, integerOnly: boolean): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${label} must be a number.`;
  }
  if (integerOnly && !Number.isInteger(value)) {
    return `${label} must be a whole number.`;
  }
  if (value < 0) return `${label} cannot be negative.`;
  if (value > max) return `${label} is implausibly large (max ${max}).`;
  return null;
}

// Returns null when valid, or a human-readable reason when not.
export function validateScoreValue(valueRaw: unknown): string | null {
  if (typeof valueRaw !== "object" || valueRaw === null || Array.isArray(valueRaw)) {
    return "Score value must be an object.";
  }

  const entries = Object.entries(valueRaw as Record<string, unknown>);
  if (entries.length === 0) return "Score value is empty.";

  for (const [key] of entries) {
    if (!ALLOWED_KEYS.has(key)) return `Unrecognised score field "${key}".`;
  }

  const v = valueRaw as ScoreValue;

  if ("no_rep" in v && typeof v.no_rep !== "boolean") {
    return "no_rep must be true or false.";
  }

  // A no-rep carries no measurement, so it's allowed to stand alone.
  if (v.no_rep === true) return null;

  if (v.time_seconds !== undefined) {
    const err = checkNumber(v.time_seconds, MAX_TIME_SECONDS, "Time", false);
    if (err) return err;
  }
  if (v.reps !== undefined) {
    const err = checkNumber(v.reps, MAX_REPS, "Reps", true);
    if (err) return err;
  }
  if (v.load_kg !== undefined) {
    const err = checkNumber(v.load_kg, MAX_LOAD_KG, "Load", false);
    if (err) return err;
  }

  // Must actually measure something — an object of only `no_rep: false`
  // would otherwise pass and land on the leaderboard as an unrankable row.
  if (v.time_seconds === undefined && v.reps === undefined && v.load_kg === undefined) {
    return "Score must record a time, reps, or a load.";
  }

  return null;
}

// Tiebreaks reuse the same shape and bounds, minus the no_rep flag and
// the "must measure something" rule (a null tiebreak is normal).
export function validateTiebreakValue(tiebreak: unknown): string | null {
  if (tiebreak === null || tiebreak === undefined) return null;
  return validateScoreValue(tiebreak);
}
