import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/scoring";
import { generateHeatsForDivision, moveAssignment, correctScore, deleteScore } from "./actions";

type ValueRaw = { time_seconds?: number; reps?: number; load_kg?: number };

function formatScore(valueRaw: ValueRaw, scoringType: string): string {
  if (scoringType === "time" && valueRaw.time_seconds != null) return formatTime(valueRaw.time_seconds);
  if (valueRaw.reps != null) return `${valueRaw.reps} reps`;
  if (valueRaw.load_kg != null) return `${valueRaw.load_kg} kg`;
  return "—";
}

function scoreInputDefault(valueRaw: ValueRaw, scoringType: string): string {
  if (scoringType === "time" && valueRaw.time_seconds != null) return formatTime(valueRaw.time_seconds);
  if (valueRaw.reps != null) return String(valueRaw.reps);
  if (valueRaw.load_kg != null) return String(valueRaw.load_kg);
  return "";
}

export default async function HeatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; divisionId: string }>;
  searchParams: Promise<{ workoutId?: string }>;
}) {
  const { eventId, divisionId } = await params;
  const { workoutId: workoutIdParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: division }, { data: workouts }, { data: divisions }] = await Promise.all([
    supabase.from("divisions").select("name").eq("id", divisionId).single(),
    supabase
      .from("workouts")
      .select("id, name, sequence, lane_count, heat_duration_minutes, transition_minutes, scoring_type, tiebreak_enabled")
      .eq("division_id", divisionId)
      .order("sequence", { ascending: true }),
    // Sibling divisions in this same event, for the quick-switch pills
    // below — Tjokkie (2026-08-13) wanted to jump between divisions
    // without going back to the divisions list each time, same as the
    // existing workout pills further down.
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("created_at", { ascending: true }),
  ]);

  const activeWorkout = (workouts ?? []).find((w) => w.id === workoutIdParam) ?? (workouts ?? [])[0] ?? null;

  const { data: heats } = activeWorkout
    ? await supabase
        .from("heats")
        .select(
          "id, heat_number, start_time, end_time, status, heat_assignments(id, lane_number, registrations(id, team_name, registration_athletes(full_name, is_captain)))"
        )
        .eq("workout_id", activeWorkout.id)
        .order("heat_number", { ascending: true })
    : { data: [] as never[] };

  const allHeats = heats ?? [];

  // Outstanding-scores dashboard: how many lanes in each heat have at
  // least one score recorded, vs the total lane count — the product-
  // level backstop that lets the organizer chase a judge whose device
  // is still offline before leaderboard time, on top of the client-side
  // sync queue itself.
  const allAssignmentIds = allHeats.flatMap((h) => h.heat_assignments.map((a) => a.id));
  const { data: scoredRows } = allAssignmentIds.length
    ? await supabase.from("scores").select("heat_assignment_id").in("heat_assignment_id", allAssignmentIds)
    : { data: [] as { heat_assignment_id: string }[] };
  const scoredAssignmentIds = new Set((scoredRows ?? []).map((r) => r.heat_assignment_id));

  // Current score per lane for this workout, so an organizer/head judge
  // can see and correct/delete what's already been entered rather than
  // retyping blind. Scoped in JS (not the query) against the active
  // workout so free-text legacy entries (workout_ref_id null, matched
  // by name) still show up alongside workout-builder entries.
  const { data: latestScoreRows } = allAssignmentIds.length
    ? await supabase
        .from("latest_scores")
        .select("id, heat_assignment_id, workout_id, workout_ref_id, value_raw, submitted_at")
        .in("heat_assignment_id", allAssignmentIds)
    : { data: [] as never[] };
  const scoreByAssignment = new Map(
    (latestScoreRows ?? [])
      .filter((s) => (activeWorkout ? s.workout_ref_id === activeWorkout.id || (!s.workout_ref_id && s.workout_id === activeWorkout.name) : false))
      .map((s) => [s.heat_assignment_id, s])
  );

  function athleteLabel(reg: {
    team_name: string | null;
    registration_athletes: { full_name: string; is_captain: boolean }[];
  }) {
    if (reg.team_name) return reg.team_name;
    const captain = reg.registration_athletes.find((a) => a.is_captain) ?? reg.registration_athletes[0];
    return captain?.full_name ?? "Unnamed";
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <a href={`/events/${eventId}/divisions`} className="text-accent text-sm hover:underline">
          ← Divisions
        </a>
        <h1 className="text-2xl font-semibold mt-1">{division?.name ?? "Division"} — Heats</h1>
      </div>

      {(divisions ?? []).length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {(divisions ?? []).map((d) => (
            <a
              key={d.id}
              href={`/events/${eventId}/divisions/${d.id}/heats`}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                d.id === divisionId
                  ? "bg-ink text-white border-ink"
                  : "border-ink/10 text-ink/60 hover:border-ink/30"
              }`}
            >
              {d.name}
            </a>
          ))}
        </div>
      )}

      {(workouts ?? []).length > 1 && (
        <div className="flex gap-2">
          {(workouts ?? []).map((w) => (
            <a
              key={w.id}
              href={`?workoutId=${w.id}`}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                activeWorkout?.id === w.id
                  ? "bg-accent text-white border-accent"
                  : "border-ink/10 text-ink/60 hover:border-accent/50"
              }`}
            >
              {w.sequence}. {w.name}
            </a>
          ))}
        </div>
      )}

      {!activeWorkout && (
        <p className="text-ink/60 text-sm">
          No workouts yet —{" "}
          <a href={`/events/${eventId}/divisions/${divisionId}/workouts`} className="text-accent hover:underline">
            create one first
          </a>{" "}
          before generating heats.
        </p>
      )}

      {activeWorkout && (
      <form
        action={generateHeatsForDivision}
        className="bg-white border border-ink/10 rounded-xl p-6 space-y-4"
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="divisionId" value={divisionId} />
        <input type="hidden" name="workoutId" value={activeWorkout.id} />
        <h2 className="font-semibold">Generate heats for &ldquo;{activeWorkout.name}&rdquo;</h2>
        <p className="text-ink/60 text-sm">
          Only regenerates heats that haven&apos;t started — in-progress or completed heats are
          never touched.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Lane count"
            name="laneCount"
            type="number"
            defaultValue={activeWorkout.lane_count?.toString()}
          />
          <Field
            label="Heat duration (min)"
            name="heatDurationMinutes"
            type="number"
            defaultValue={activeWorkout.heat_duration_minutes?.toString()}
          />
          <Field
            label="Transition (min)"
            name="transitionMinutes"
            type="number"
            defaultValue={activeWorkout.transition_minutes?.toString() ?? "0"}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First heat date" name="startDate" type="date" required />
          <Field label="First heat time" name="startTimeOfDay" type="time" required />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink/50 mb-1">
            Lane order
          </label>
          <select
            name="seedMode"
            defaultValue="standings"
            className="w-full text-sm border border-ink/10 rounded-lg px-3 py-2"
          >
            <option value="standings">Seed by standings — leaders in the last heat</option>
            <option value="registration">Registration order</option>
          </select>
          <p className="text-ink/50 text-xs mt-1">
            Seeding uses the cumulative standings from earlier workouts in this division. The first
            workout has no earlier results, so it always falls back to registration order.
          </p>
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Generate
        </button>
      </form>
      )}

      <a href={`/leaderboard/${divisionId}`} className="text-accent text-sm hover:underline">
        View public leaderboard →
      </a>

      <div className="space-y-4">
        {allHeats.map((heat) => {
          const scoredCount = heat.heat_assignments.filter((a) => scoredAssignmentIds.has(a.id)).length;
          const totalCount = heat.heat_assignments.length;
          const allScored = totalCount > 0 && scoredCount === totalCount;
          return (
          <div key={heat.id} className="bg-white border border-ink/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold">
                Heat {heat.heat_number} · {new Date(heat.start_time).toLocaleTimeString()}
              </p>
              <div className="flex items-center gap-2">
                {totalCount > 0 && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      allScored ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {scoredCount}/{totalCount} scored
                  </span>
                )}
                <span className="text-xs uppercase tracking-wider text-ink/50">{heat.status}</span>
              </div>
            </div>
            <div className="space-y-3">
              {heat.heat_assignments
                .sort((a, b) => a.lane_number - b.lane_number)
                .map((a) => {
                  const reg = Array.isArray(a.registrations) ? a.registrations[0] : a.registrations;
                  const score = scoreByAssignment.get(a.id);
                  const scoringType = activeWorkout?.scoring_type ?? "time";
                  return (
                    <div key={a.id} className="space-y-1.5 border-b border-ink/5 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          Lane {a.lane_number} — {reg ? athleteLabel(reg) : "Unknown"}
                        </span>
                        <form action={moveAssignment} className="flex items-center gap-1">
                          <input type="hidden" name="eventId" value={eventId} />
                          <input type="hidden" name="divisionId" value={divisionId} />
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <select
                            name="heatId"
                            defaultValue={heat.id}
                            className="text-xs border border-ink/10 rounded px-1 py-0.5"
                          >
                            {allHeats.map((h) => (
                              <option key={h.id} value={h.id}>
                                Heat {h.heat_number}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            name="laneNumber"
                            defaultValue={a.lane_number}
                            className="w-14 text-xs border border-ink/10 rounded px-1 py-0.5"
                          />
                          <button type="submit" className="text-xs text-accent font-semibold">
                            Move
                          </button>
                        </form>
                      </div>
                      {activeWorkout && (
                        <div className="flex items-center gap-2 text-xs text-ink/60">
                          <span>
                            Score: {score ? formatScore(score.value_raw as ValueRaw, scoringType) : "Not entered"}
                          </span>
                          <details className="ml-auto">
                            <summary className="text-accent font-semibold cursor-pointer list-none">
                              {score ? "Correct" : "Enter score"}
                            </summary>
                            <form
                              action={correctScore}
                              className="mt-2 flex items-center gap-2 bg-paper rounded-lg p-2"
                            >
                              <input type="hidden" name="eventId" value={eventId} />
                              <input type="hidden" name="divisionId" value={divisionId} />
                              <input type="hidden" name="heatAssignmentId" value={a.id} />
                              <input type="hidden" name="workoutId" value={activeWorkout.name} />
                              <input type="hidden" name="workoutRefId" value={activeWorkout.id} />
                              <input type="hidden" name="scoringType" value={scoringType} />
                              <input
                                type="text"
                                name="value"
                                placeholder={scoringType === "time" ? "mm:ss" : scoringType === "reps" ? "reps" : "kg"}
                                defaultValue={score ? scoreInputDefault(score.value_raw as ValueRaw, scoringType) : ""}
                                className="w-20 border border-ink/10 rounded px-2 py-1 text-xs"
                              />
                              <button type="submit" className="text-xs bg-accent text-white rounded px-2 py-1 font-semibold">
                                Save
                              </button>
                            </form>
                          </details>
                          {score && (
                            <form action={deleteScore}>
                              <input type="hidden" name="eventId" value={eventId} />
                              <input type="hidden" name="divisionId" value={divisionId} />
                              <input type="hidden" name="scoreId" value={score.id} />
                              <button type="submit" className="text-ink/40 hover:text-ink/70">
                                Delete
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
          );
        })}
        {allHeats.length === 0 && (
          <p className="text-ink/60 text-sm">No heats generated yet.</p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
      />
    </div>
  );
}
