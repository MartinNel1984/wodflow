import { formatTime } from "@/lib/scoring";

export type LeaderboardRow = {
  heat_assignment_id: string;
  workout_id: string;
  value_raw: { time_seconds?: number; reps?: number; load_kg?: number; no_rep?: boolean };
  tiebreak_value: { time_seconds?: number; reps?: number; load_kg?: number } | null;
  registration_id: string;
  display_name: string;
  workout_name?: string;
  workout_scoring_config?: ScoringConfig | null;
  rx_or_scaled?: "rx" | "scaled" | null;
  workout_sequence?: number | null;
};

export type ScoringConfig =
  | { method: "rank_sum" }
  | { method: "gap_formula"; winner_points?: number; gap_points?: number };

export type WorkoutResult = {
  registrationId: string;
  displayName: string;
  display: string; // formatted time or "N reps"
  capped: boolean; // true when this entry recorded reps instead of a finish time
  position: number;
  points: number;
  tiebreakDisplay: string | null; // formatted tiebreak_value, when the judge recorded one
  rxOrScaled: "rx" | "scaled" | null; // display/filter tag only — never affects ranking or points
};

export type Standing = {
  registrationId: string;
  displayName: string;
  totalPoints: number;
  place: number;
  workoutScores: Record<
    string,
    | {
        display: string;
        points: number;
        position: number;
        tiebreakDisplay: string | null;
        rxOrScaled: "rx" | "scaled" | null;
      }
    | undefined
  >;
};

// Two point tables, both driven by divisions.scoring_config:
//   rank_sum    — points = entrants - position + 1 (today's default,
//                 unchanged behavior for every division that hasn't
//                 opted into the other one).
//   gap_formula — Tjokkie's model: winner scores winner_points (100 by
//                 default), last place lands at exactly 1, everyone in
//                 between linearly interpolated and rounded. Prior
//                 version pre-rounded the per-position gap, which for
//                 ~40-entrant fields rounded 100/(N-1) up and
//                 flat-lined the tail at 0 — Tjokkie flagged this
//                 2026-10-05: Paul Raath scored 1 in Indy 2026 but
//                 wasn't last. Linear round-at-the-end puts every
//                 entrant on at least 1 point regardless of field
//                 size. A manual gap_points override still short-
//                 circuits the formula for the "spread is 5 because we
//                 have 20 teams" case.
// Exported for reuse by lib/series.ts — season points (Milestone 18)
// are the same pluggable formula applied to an athlete's OVERALL
// event placement instead of a per-workout one.
export function pointsForPosition(position: number, entrants: number, config: ScoringConfig): number {
  if (config.method === "gap_formula") {
    const winnerPoints = config.winner_points ?? 100;
    if (config.gap_points != null) {
      return Math.max(0, winnerPoints - (position - 1) * config.gap_points);
    }
    if (entrants <= 1) return winnerPoints;
    const raw = winnerPoints - ((position - 1) * (winnerPoints - 1)) / (entrants - 1);
    return Math.max(1, Math.round(raw));
  }
  return entrants - position + 1;
}

function tiebreakOf(
  row: { tiebreak_value: LeaderboardRow["tiebreak_value"] },
  key: "time_seconds" | "reps" | "load_kg"
) {
  return row.tiebreak_value?.[key];
}

// Same three shapes a workout score can take (time/reps/load), formatted
// the same way as the primary display value — shown alongside a result
// so athletes can see exactly what broke a tie instead of asking.
function formatTiebreak(value: LeaderboardRow["tiebreak_value"]): string | null {
  if (!value) return null;
  if (value.time_seconds != null) return formatTime(value.time_seconds);
  if (value.reps != null) return `${value.reps} reps`;
  if (value.load_kg != null) return `${value.load_kg} kg`;
  return null;
}

// Competition-standard scoring: within a workout, every athlete who
// finished (recorded a time) outranks every athlete who was capped out
// (recorded reps instead) — finishers are ordered by time ascending,
// capped-out athletes by reps descending as a tiebreak among
// themselves. When two athletes land on the exact same primary score,
// tiebreak_value (same shape as the main score, entered alongside it —
// see Milestone 12) breaks the tie the same direction as the primary
// metric; if neither or only one has a tiebreak recorded, the tie is
// left as-is (stable order) rather than guessed. A missing score ranks
// worse than everyone. Overall total is the sum of a registration's
// per-workout points, highest total wins.
export function computeWorkoutResults(
  rows: LeaderboardRow[],
  registrationIds: string[],
  scoringConfig: ScoringConfig = { method: "rank_sum" }
): WorkoutResult[] {
  const nameByRegistration = new Map(rows.map((r) => [r.registration_id, r.display_name]));
  const tiebreakByRegistration = new Map(rows.map((r) => [r.registration_id, formatTiebreak(r.tiebreak_value)]));
  const rxScaledByRegistration = new Map(rows.map((r) => [r.registration_id, r.rx_or_scaled ?? null]));

  const finishers = rows
    .filter((r) => !r.value_raw.no_rep && r.value_raw.time_seconds != null)
    .map((r) => ({
      registrationId: r.registration_id,
      time: r.value_raw.time_seconds!,
      tiebreak: tiebreakOf(r, "time_seconds"),
    }))
    .sort((a, b) => a.time - b.time || (a.tiebreak ?? Infinity) - (b.tiebreak ?? Infinity));

  // Reps or load — whichever secondary metric was recorded (either a
  // capped-out time-workout entry, or the primary metric for a pure
  // reps/load division that has no finish-time concept at all).
  const finishedIds = new Set(finishers.map((f) => f.registrationId));
  const secondary = rows
    .filter((r) => !r.value_raw.no_rep && (r.value_raw.reps != null || r.value_raw.load_kg != null) && !finishedIds.has(r.registration_id))
    .map((r) => {
      // Capped-out athletes almost always break ties by TIME — the clock-time
      // they reached their last rep. Judges enter it in the tiebreak field as
      // time_seconds, so prefer that; lower time wins. Fall back to the
      // matching unit (reps/load, higher wins) when no time was recorded, so
      // reps-only workouts without a time dimension still tiebreak correctly.
      // Before this, we read the tiebreak with key "reps"/"load_kg" and got
      // undefined for time-based tiebreaks, silently dropping them (Tjokkie,
      // 2026-10-04 — Rumble capped workouts showed identical reps as a tie
      // even though the judges had entered different tiebreak times).
      const unit: "reps" | "kg" = r.value_raw.reps != null ? "reps" : "kg";
      const tiebreakTime = tiebreakOf(r, "time_seconds");
      const tiebreakSameUnit = tiebreakOf(r, unit === "reps" ? "reps" : "load_kg");
      return {
        registrationId: r.registration_id,
        value: (r.value_raw.reps ?? r.value_raw.load_kg)!,
        unit,
        tiebreakTime,
        tiebreakSameUnit,
      };
    })
    .sort((a, b) => {
      if (a.value !== b.value) return b.value - a.value;
      if (a.tiebreakTime != null || b.tiebreakTime != null) {
        return (a.tiebreakTime ?? Infinity) - (b.tiebreakTime ?? Infinity);
      }
      return (b.tiebreakSameUnit ?? -Infinity) - (a.tiebreakSameUnit ?? -Infinity);
    });

  const ordered = [
    ...finishers.map((f) => ({
      registrationId: f.registrationId,
      display: formatTime(f.time),
      capped: false,
      tieKey: `${f.time}|${f.tiebreak ?? ""}`,
    })),
    ...secondary.map((s) => ({
      registrationId: s.registrationId,
      display: `${s.value} ${s.unit}`,
      capped: true,
      tieKey: `${s.value}|${s.tiebreakTime ?? ""}|${s.tiebreakSameUnit ?? ""}`,
    })),
  ];

  const entrants = registrationIds.length;
  const results = ordered.map((entry, i) => ({
    registrationId: entry.registrationId,
    displayName: nameByRegistration.get(entry.registrationId) ?? "Unnamed",
    display: entry.display,
    capped: entry.capped,
    position: i + 1,
    points: pointsForPosition(i + 1, entrants, scoringConfig),
    tiebreakDisplay: tiebreakByRegistration.get(entry.registrationId) ?? null,
    rxOrScaled: rxScaledByRegistration.get(entry.registrationId) ?? null,
  }));

  // Standard competition ranking within a workout too (Tjokkie,
  // 2026-09-29) — a genuine tie (same time/value, and either the same
  // tiebreak or neither entered one) now shares the higher position and
  // points, the same "1, 1, 3" rule computeStandings already applies to
  // overall totals. Before this, two identical times still got
  // sequential positions from the stable sort, so whichever row the DB
  // happened to return first quietly won the tie.
  for (let i = 1; i < results.length; i++) {
    if (ordered[i].capped === ordered[i - 1].capped && ordered[i].tieKey === ordered[i - 1].tieKey) {
      results[i].position = results[i - 1].position;
      results[i].points = results[i - 1].points;
    }
  }

  return results;
}

// Full-division standings — one workout's results feed into an overall
// points total per registration, ranked highest-total-wins. Each workout
// uses its OWN scoring_config (M17 winner_points/gap, now settable per
// workout — a 100-point WOD and a 50-point WOD can carry different
// spreads) when it has one, falling back to the division's default
// otherwise, so divisions that never set a per-workout override keep
// behaving exactly as before.
export function computeStandings(
  rows: LeaderboardRow[],
  divisionScoringConfig: ScoringConfig = { method: "rank_sum" }
): {
  standings: Standing[];
  workouts: { id: string; name: string; results: WorkoutResult[] }[];
} {
  const registrationIds = [...new Set(rows.map((r) => r.registration_id))];
  const nameByRegistration = new Map(rows.map((r) => [r.registration_id, r.display_name]));

  // Column order follows the event's running order (Tjokkie, 2026-09-29):
  // sort by each workout's `sequence`, falling back to workout_id for
  // rows from before migration-085 added it so nothing crashes on stale
  // cached data — that fallback is arbitrary but stable, not "correct"
  // order, it just keeps ties from reshuffling on every render.
  const sequenceByWorkout = new Map(rows.map((r) => [r.workout_id, r.workout_sequence ?? null]));
  const workoutIds = [...new Set(rows.map((r) => r.workout_id))].sort((a, b) => {
    const seqA = sequenceByWorkout.get(a);
    const seqB = sequenceByWorkout.get(b);
    if (seqA != null && seqB != null && seqA !== seqB) return seqA - seqB;
    return a.localeCompare(b);
  });

  const resultsByWorkout = new Map<string, WorkoutResult[]>();
  const nameByWorkout = new Map<string, string>();
  for (const workoutId of workoutIds) {
    const workoutRows = rows.filter((r) => r.workout_id === workoutId);
    const workoutConfig = workoutRows.find((r) => r.workout_scoring_config)?.workout_scoring_config;
    nameByWorkout.set(workoutId, workoutRows[0]?.workout_name ?? workoutId);
    resultsByWorkout.set(
      workoutId,
      computeWorkoutResults(workoutRows, registrationIds, workoutConfig ?? divisionScoringConfig)
    );
  }

  const pointsByRegistration = new Map<string, number>();
  const workoutScoresByRegistration = new Map<string, Standing["workoutScores"]>();
  for (const [workoutId, results] of resultsByWorkout) {
    for (const r of results) {
      pointsByRegistration.set(r.registrationId, (pointsByRegistration.get(r.registrationId) ?? 0) + r.points);
      const scores = workoutScoresByRegistration.get(r.registrationId) ?? {};
      scores[workoutId] = {
        display: r.display,
        points: r.points,
        position: r.position,
        tiebreakDisplay: r.tiebreakDisplay,
        rxOrScaled: r.rxOrScaled,
      };
      workoutScoresByRegistration.set(r.registrationId, scores);
    }
  }

  // Overall tiebreak when totals are equal: whichever team has the better
  // single-workout finish across the weekend wins (Tjokkie, 2026-10-04 —
  // Rumble final-workout call). If that's still equal, compare their 2nd
  // best, 3rd best, etc. — this is the standard "count-back" rule and
  // mirrors how CrossFit Games break Open ties. Only teams on the exact
  // same total points get reordered; the shared place still collapses
  // afterwards if their count-back is also identical.
  function bestFinishesAsc(registrationId: string): number[] {
    const scores = workoutScoresByRegistration.get(registrationId) ?? {};
    return Object.values(scores)
      .map((s) => s?.position ?? Infinity)
      .sort((a, b) => a - b);
  }
  const bestFinishesByRegistration = new Map(
    registrationIds.map((id) => [id, bestFinishesAsc(id)])
  );

  const sorted = registrationIds
    .map((registrationId) => ({
      registrationId,
      displayName: nameByRegistration.get(registrationId) ?? "Unnamed",
      totalPoints: pointsByRegistration.get(registrationId) ?? 0,
      workoutScores: workoutScoresByRegistration.get(registrationId) ?? {},
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const aFinishes = bestFinishesByRegistration.get(a.registrationId) ?? [];
      const bFinishes = bestFinishesByRegistration.get(b.registrationId) ?? [];
      const len = Math.max(aFinishes.length, bFinishes.length);
      for (let i = 0; i < len; i++) {
        const av = aFinishes[i] ?? Infinity;
        const bv = bFinishes[i] ?? Infinity;
        if (av !== bv) return av - bv;
      }
      return 0;
    });

  // Standard competition ranking (1, 1, 3 — not 1, 1, 2): teams whose
  // total AND count-back are both identical share a place; the next
  // distinct team resumes at "how many finished ahead of it + 1". Teams
  // tied on points but split by the count-back get sequential places.
  const standings: Standing[] = sorted.map((s, i) => ({ ...s, place: i + 1 }));
  for (let i = 1; i < standings.length; i++) {
    const prev = standings[i - 1];
    const curr = standings[i];
    if (curr.totalPoints !== prev.totalPoints) continue;
    const prevFinishes = bestFinishesByRegistration.get(prev.registrationId) ?? [];
    const currFinishes = bestFinishesByRegistration.get(curr.registrationId) ?? [];
    const len = Math.max(prevFinishes.length, currFinishes.length);
    let identical = true;
    for (let j = 0; j < len; j++) {
      if ((prevFinishes[j] ?? Infinity) !== (currFinishes[j] ?? Infinity)) {
        identical = false;
        break;
      }
    }
    if (identical) curr.place = prev.place;
  }

  const workouts = workoutIds.map((id) => ({
    id,
    name: nameByWorkout.get(id) ?? id,
    results: resultsByWorkout.get(id)!,
  }));

  return { standings, workouts };
}
