import { createClient } from "@/lib/supabase/server";
import { generateHeatsForDivision, moveAssignment } from "./actions";

export default async function HeatsPage({
  params,
}: {
  params: Promise<{ eventId: string; divisionId: string }>;
}) {
  const { eventId, divisionId } = await params;
  const supabase = await createClient();

  const [{ data: division }, { data: heats }] = await Promise.all([
    supabase
      .from("divisions")
      .select("name, lane_count, heat_duration_minutes, transition_minutes")
      .eq("id", divisionId)
      .single(),
    supabase
      .from("heats")
      .select(
        "id, heat_number, start_time, end_time, status, heat_assignments(id, lane_number, registrations(id, team_name, registration_athletes(full_name, is_captain)))"
      )
      .eq("division_id", divisionId)
      .order("heat_number", { ascending: true }),
  ]);

  const allHeats = heats ?? [];

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

      <form
        action={generateHeatsForDivision}
        className="bg-white border border-ink/10 rounded-xl p-6 space-y-4"
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="divisionId" value={divisionId} />
        <h2 className="font-semibold">Generate heats</h2>
        <p className="text-ink/60 text-sm">
          Only regenerates heats that haven&apos;t started — in-progress or completed heats are
          never touched.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Lane count"
            name="laneCount"
            type="number"
            defaultValue={division?.lane_count?.toString()}
          />
          <Field
            label="Heat duration (min)"
            name="heatDurationMinutes"
            type="number"
            defaultValue={division?.heat_duration_minutes?.toString()}
          />
          <Field
            label="Transition (min)"
            name="transitionMinutes"
            type="number"
            defaultValue={division?.transition_minutes?.toString() ?? "0"}
          />
        </div>
        <Field label="First heat starts at" name="startTime" type="datetime-local" required />
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Generate
        </button>
      </form>

      <div className="space-y-4">
        {allHeats.map((heat) => (
          <div key={heat.id} className="bg-white border border-ink/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold">
                Heat {heat.heat_number} · {new Date(heat.start_time).toLocaleTimeString()}
              </p>
              <span className="text-xs uppercase tracking-wider text-ink/50">{heat.status}</span>
            </div>
            <div className="space-y-2">
              {heat.heat_assignments
                .sort((a, b) => a.lane_number - b.lane_number)
                .map((a) => {
                  const reg = Array.isArray(a.registrations) ? a.registrations[0] : a.registrations;
                  return (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span>
                        Lane {a.lane_number} — {reg ? athleteLabel(reg) : "Unknown"}
                      </span>
                      <form action={moveAssignment} className="flex items-center gap-1">
                        <input type="hidden" name="eventId" value={eventId} />
                        <input type="hidden" name="divisionId" value={divisionId} />
                        <input type="hidden" name="assignmentId" value={a.id} />
                        <input type="hidden" name="heatId" value={heat.id} />
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
                  );
                })}
            </div>
          </div>
        ))}
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
