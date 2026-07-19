import { createClient } from "@/lib/supabase/server";

type Row = {
  heat_assignment_id: string;
  workout_id: string;
  value_raw: { time_seconds?: number; reps?: number; load_kg?: number; no_rep?: boolean };
  registration_id: string;
  display_name: string;
};

// Standard aggregate-rank scoring: each workout is ranked independently
// (best performance = rank 1), then a registration's total is the sum
// of its per-workout ranks — lower total wins. A registration with no
// score for a given workout gets a worst-case penalty rank (one worse
// than last place), matching how most CrossFit-style comps handle a
// missed/DNF workout. No tiebreak rules yet — a documented Phase 1
// simplification, revisit if ties turn out to matter in practice.
function computeStandings(rows: Row[], scoringType: "time" | "reps" | "load") {
  const workoutIds = [...new Set(rows.map((r) => r.workout_id))];
  const registrationIds = [...new Set(rows.map((r) => r.registration_id))];
  const nameByRegistration = new Map(rows.map((r) => [r.registration_id, r.display_name]));

  const rankByRegistrationAndWorkout = new Map<string, number>();

  for (const workoutId of workoutIds) {
    const entries = rows
      .filter((r) => r.workout_id === workoutId)
      .map((r) => {
        const v = r.value_raw;
        const value = v.no_rep ? null : (v.time_seconds ?? v.reps ?? v.load_kg ?? null);
        return { registrationId: r.registration_id, value };
      })
      .filter((e) => e.value != null) as { registrationId: string; value: number }[];

    // time: lower is better. reps/load: higher is better.
    entries.sort((a, b) => (scoringType === "time" ? a.value - b.value : b.value - a.value));

    entries.forEach((e, i) => {
      rankByRegistrationAndWorkout.set(`${e.registrationId}:${workoutId}`, i + 1);
    });

    const worstRank = entries.length + 1;
    for (const regId of registrationIds) {
      const key = `${regId}:${workoutId}`;
      if (!rankByRegistrationAndWorkout.has(key)) {
        rankByRegistrationAndWorkout.set(key, worstRank);
      }
    }
  }

  const standings = registrationIds.map((regId) => {
    const total = workoutIds.reduce(
      (sum, w) => sum + (rankByRegistrationAndWorkout.get(`${regId}:${w}`) ?? 0),
      0
    );
    return { registrationId: regId, displayName: nameByRegistration.get(regId) ?? "Unnamed", total };
  });

  standings.sort((a, b) => a.total - b.total);
  return { standings, workoutIds };
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ divisionId: string }>;
}) {
  const { divisionId } = await params;
  const supabase = await createClient();

  const [{ data: division }, { data: rows }] = await Promise.all([
    supabase.from("divisions").select("name, workout_scoring_type").eq("id", divisionId).single(),
    supabase
      .from("public_leaderboard")
      .select("heat_assignment_id, workout_id, value_raw, registration_id, display_name")
      .eq("division_id", divisionId),
  ]);

  const scoringType = (division?.workout_scoring_type ?? "time") as "time" | "reps" | "load";
  const { standings, workoutIds } = computeStandings((rows ?? []) as Row[], scoringType);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-center">{division?.name ?? "Leaderboard"}</h1>
      {workoutIds.length === 0 ? (
        <p className="text-center text-ink/60 text-sm">No scores yet.</p>
      ) : (
        <table className="w-full bg-white border border-ink/10 rounded-xl overflow-hidden text-sm">
          <thead>
            <tr className="bg-ink/5 text-left">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.registrationId} className="border-t border-ink/10">
                <td className="px-4 py-2 font-semibold">{i + 1}</td>
                <td className="px-4 py-2">{s.displayName}</td>
                <td className="px-4 py-2 text-right">{s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
