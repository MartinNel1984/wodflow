import { createClient } from "@/lib/supabase/server";
import { createJudge, assignJudgeToHeat } from "./actions";

export default async function JudgesPage() {
  const supabase = await createClient();

  const [{ data: judges }, { data: heats }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "judge").order("full_name"),
    supabase
      .from("heats")
      .select("id, heat_number, divisions(name)")
      .order("heat_number", { ascending: true }),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Judges</h1>

      <div className="space-y-3">
        {(judges ?? []).map((j) => (
          <div key={j.id} className="bg-white border border-ink/10 rounded-xl p-4">
            <p className="font-semibold mb-2">{j.full_name}</p>
            <form action={assignJudgeToHeat} className="flex items-center gap-2">
              <input type="hidden" name="profileId" value={j.id} />
              <select name="heatId" className="flex-1 text-sm border border-ink/10 rounded-lg px-2 py-1">
                {(heats ?? []).map((h) => {
                  const div = Array.isArray(h.divisions) ? h.divisions[0] : h.divisions;
                  return (
                    <option key={h.id} value={h.id}>
                      {div?.name ?? "Division"} — Heat {h.heat_number}
                    </option>
                  );
                })}
              </select>
              <button type="submit" className="text-sm text-accent font-semibold">
                Assign
              </button>
            </form>
          </div>
        ))}
        {(!judges || judges.length === 0) && (
          <p className="text-ink/60 text-sm">No judges yet — create one below.</p>
        )}
      </div>

      <form action={createJudge} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">New judge</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              Full name
            </label>
            <input
              name="fullName"
              required
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              4-digit PIN
            </label>
            <input
              name="pin"
              required
              pattern="\d{4}"
              maxLength={4}
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Create judge
        </button>
      </form>
    </div>
  );
}
