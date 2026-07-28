// Pure functions for the workout/scoresheet builder — no Supabase
// here so this stays unit-testable in isolation (same pattern as
// lib/heats.ts and lib/scoring.ts).
//
// The cumulative rep-reference grid printed on real paper scoresheets
// (e.g. /03 /08 /16 per round) is derived here, never stored — it's a
// read-only aid for whoever is scoring, not something athletes are
// scored against directly (the actual score stays one final number,
// per the design doc). Movements within a workout are assumed to
// share the same round count (true of every real workout reviewed —
// a workout is N rounds of its movements together, not movements
// running independent round counts).

export type Movement = {
  id: string;
  sequence: number;
  name: string;
  reps: number | null;
  rounds: number;
};

export type CumulativeCell = {
  movementId: string;
  movementName: string;
  cumulative: number | null;
};

export type CumulativeRound = {
  round: number;
  cells: CumulativeCell[];
};

export function cumulativeReference(movements: Movement[]): CumulativeRound[] {
  if (movements.length === 0) return [];
  const ordered = [...movements].sort((a, b) => a.sequence - b.sequence);
  const totalRounds = Math.max(...ordered.map((m) => m.rounds), 1);

  const rounds: CumulativeRound[] = [];
  let running = 0;

  for (let round = 1; round <= totalRounds; round++) {
    const cells: CumulativeCell[] = ordered.map((m) => {
      if (m.reps != null) running += m.reps;
      return {
        movementId: m.id,
        movementName: m.name,
        cumulative: m.reps != null ? running : null,
      };
    });
    rounds.push({ round, cells });
  }

  return rounds;
}
