import { createClient } from "@/lib/supabase/server";
import { cumulativeReference } from "@/lib/workouts";
import { requireOrganizer } from "@/lib/auth";
import { createWorkout, deleteWorkout, addMovement, deleteMovement, copyWorkoutsFromDivision } from "./actions";

export default async function WorkoutsPage({
  params,
}: {
  params: Promise<{ eventId: string; divisionId: string }>;
}) {
  const { eventId, divisionId } = await params;
  const supabase = await createClient();
  const { organizationId } = await requireOrganizer();

  const [{ data: division }, { data: workouts }, { data: otherDivisions }] = await Promise.all([
    supabase.from("divisions").select("name").eq("id", divisionId).single(),
    supabase
      .from("workouts")
      .select("id, name, sequence, cap_seconds, scoring_type, tiebreak_enabled, lane_count, heat_duration_minutes, transition_minutes, workout_movements(id, sequence, name, reps, load, rounds)")
      .eq("division_id", divisionId)
      .order("sequence", { ascending: true }),
    supabase
      .from("divisions")
      .select("id, name, events!inner(name, organization_id)")
      .eq("events.organization_id", organizationId)
      .neq("id", divisionId)
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <a href={`/events/${eventId}/divisions`} className="text-accent text-sm hover:underline">
          ← Divisions
        </a>
        <h1 className="text-2xl font-semibold mt-1">{division?.name ?? "Division"} — Workouts</h1>
      </div>

      {otherDivisions && otherDivisions.length > 0 && (
        <form
          action={copyWorkoutsFromDivision}
          className="bg-paper border border-ink/10 rounded-xl p-4 flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="divisionId" value={divisionId} />
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              Copy workouts from another division
            </label>
            <select
              name="sourceDivisionId"
              required
              className="w-full bg-white rounded-lg px-4 py-3 text-sm border border-ink/10"
            >
              <option value="">Select a division…</option>
              {otherDivisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({(d.events as unknown as { name: string })?.name})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-semibold h-fit"
          >
            Copy workouts
          </button>
        </form>
      )}

      <div className="space-y-6">
        {(workouts ?? []).map((w) => {
          const movements = (w.workout_movements ?? []).slice().sort((a, b) => a.sequence - b.sequence);
          const reference = cumulativeReference(
            movements.map((m) => ({
              id: m.id,
              sequence: m.sequence,
              name: m.name,
              reps: m.reps,
              rounds: m.rounds,
            }))
          );

          return (
            <div key={w.id} className="bg-white border border-ink/10 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {w.sequence}. {w.name}
                  </p>
                  <p className="text-ink/60 text-sm">
                    {w.scoring_type === "time" ? "For time" : "Max reps"}
                    {w.cap_seconds ? ` · ${Math.round(w.cap_seconds / 60)} min cap` : ""}
                    {w.tiebreak_enabled ? " · tiebreak on" : ""}
                    {w.lane_count ? ` · ${w.lane_count} lanes` : ""}
                    {w.heat_duration_minutes ? ` · ${w.heat_duration_minutes} min heats` : ""}
                  </p>
                </div>
                <form action={deleteWorkout}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="divisionId" value={divisionId} />
                  <input type="hidden" name="workoutId" value={w.id} />
                  <button type="submit" className="text-sm text-ink/40 hover:text-ink/70">
                    Delete workout
                  </button>
                </form>
              </div>

              {movements.length > 0 && (
                <div className="space-y-2">
                  {movements.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm border-t border-ink/5 pt-2">
                      <span>
                        {m.rounds > 1 ? `${m.rounds} rounds of ` : ""}
                        {m.name}
                        {m.reps != null ? ` — ${m.reps} reps` : ""}
                        {m.load ? ` @ ${m.load}` : ""}
                      </span>
                      <form action={deleteMovement}>
                        <input type="hidden" name="eventId" value={eventId} />
                        <input type="hidden" name="divisionId" value={divisionId} />
                        <input type="hidden" name="movementId" value={m.id} />
                        <button type="submit" className="text-xs text-ink/40 hover:text-ink/70">
                          Remove
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}

              {reference.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/50 mb-2">
                    Cumulative rep reference (judge&apos;s quick-tally guide)
                  </p>
                  <div className="overflow-x-auto">
                    <table className="text-xs font-data w-full">
                      <thead>
                        <tr className="text-ink/50 text-left">
                          <th className="pr-3 py-1">Round</th>
                          {movements.map((m) => (
                            <th key={m.id} className="pr-3 py-1">
                              {m.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reference.map((row) => (
                          <tr key={row.round} className="border-t border-ink/5">
                            <td className="pr-3 py-1">{row.round}</td>
                            {row.cells.map((c) => (
                              <td key={c.movementId} className="pr-3 py-1">
                                {c.cumulative != null ? `/${c.cumulative}` : "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <form
                action={addMovement}
                className="bg-paper rounded-lg p-4 grid grid-cols-2 gap-3 items-end"
              >
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="divisionId" value={divisionId} />
                <input type="hidden" name="workoutId" value={w.id} />
                <Field label="Movement" name="name" required placeholder="Bar Muscle-ups" />
                <Field
                  label="Order"
                  name="sequence"
                  type="number"
                  defaultValue={String(movements.length + 1)}
                />
                <Field label="Reps" name="reps" type="number" />
                <Field label="Load" name="load" placeholder="22.5 kg" />
                <Field label="Rounds" name="rounds" type="number" defaultValue="1" />
                <button
                  type="submit"
                  className="bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-semibold h-fit"
                >
                  Add movement
                </button>
              </form>
            </div>
          );
        })}
        {(!workouts || workouts.length === 0) && (
          <p className="text-ink/60 text-sm">No workouts yet — create one below.</p>
        )}
      </div>

      <form action={createWorkout} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="divisionId" value={divisionId} />
        <h2 className="font-semibold">New workout</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" name="name" required placeholder="Love 8 Relationship" />
          <Field label="Order" name="sequence" type="number" defaultValue="1" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Time cap (minutes)" name="capMinutes" type="number" placeholder="14" />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Scoring</label>
            <select
              name="scoringType"
              defaultValue="time"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10"
            >
              <option value="time">For time</option>
              <option value="reps">Max reps</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="tiebreakEnabled" className="rounded" />
          Tiebreak enabled for this workout
        </label>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Lane count" name="laneCount" type="number" />
          <Field label="Heat duration (min)" name="heatDurationMinutes" type="number" />
          <Field label="Transition (min)" name="transitionMinutes" type="number" />
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Create workout
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
      />
    </div>
  );
}
