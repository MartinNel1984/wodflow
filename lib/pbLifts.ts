// Shared metadata for the athlete PB tracker (migration-070). One
// fixed lookup keyed by lift_key — unit and ranking direction live
// here in code, not per-row in the DB, since they never vary per
// athlete.
export type PbUnit = "kg" | "reps" | "time";

export type PbLift = {
  key: string;
  label: string;
  unit: PbUnit;
};

export const PB_LIFTS: PbLift[] = [
  { key: "clean_jerk", label: "1RM Clean & Jerk", unit: "kg" },
  { key: "snatch", label: "1RM Snatch", unit: "kg" },
  { key: "back_squat", label: "1RM Back Squat", unit: "kg" },
  { key: "deadlift", label: "1RM Deadlift", unit: "kg" },
  { key: "isabel", label: "Isabel", unit: "time" },
  { key: "grace", label: "Grace", unit: "time" },
  { key: "fran", label: "Fran", unit: "time" },
  { key: "max_pull_ups", label: "Max Pull Ups", unit: "reps" },
];

export function pbLiftByKey(key: string): PbLift | undefined {
  return PB_LIFTS.find((l) => l.key === key);
}

// value_numeric is stored as kg / reps / seconds. Format for display
// per unit — time lifts render as mm:ss.
export function formatPbValue(unit: PbUnit, value: number): string {
  if (unit === "kg") return `${value % 1 === 0 ? value : value.toFixed(1)}kg`;
  if (unit === "reps") return `${value} reps`;
  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Parses a raw form value into the seconds/kg/reps number stored in
// value_numeric. For "time" this expects mm:ss (seconds component
// passed separately by the form, see PBCard).
export function parseTimeToSeconds(minutes: number, seconds: number): number {
  return minutes * 60 + seconds;
}

export function secondsToMinutesAndSeconds(totalSeconds: number): { minutes: number; seconds: number } {
  const rounded = Math.round(totalSeconds);
  return { minutes: Math.floor(rounded / 60), seconds: rounded % 60 };
}
