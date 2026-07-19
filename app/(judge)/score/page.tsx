"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type HeatOption = {
  heatId: string;
  heatNumber: number;
  divisionName: string;
  scoringType: "time" | "reps" | "load";
};

type Lane = {
  heatAssignmentId: string;
  laneNumber: number;
  displayName: string;
};

export default function ScorePage() {
  const [heats, setHeats] = useState<HeatOption[]>([]);
  const [selectedHeatId, setSelectedHeatId] = useState("");
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [workoutId, setWorkoutId] = useState("WOD1");
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedLanes, setSavedLanes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHeats() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: assignments } = await supabase
        .from("judge_assignments")
        .select("heat_id")
        .eq("profile_id", user.id);
      const heatIds = (assignments ?? []).map((a) => a.heat_id);
      if (heatIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: heatRows } = await supabase
        .from("heats")
        .select("id, heat_number, divisions(name, workout_scoring_type)")
        .in("id", heatIds);

      const options: HeatOption[] = (heatRows ?? []).map((h) => {
        const div = Array.isArray(h.divisions) ? h.divisions[0] : h.divisions;
        return {
          heatId: h.id,
          heatNumber: h.heat_number,
          divisionName: div?.name ?? "Division",
          scoringType: (div?.workout_scoring_type ?? "time") as HeatOption["scoringType"],
        };
      });
      setHeats(options);
      setLoading(false);
    }
    loadHeats();
  }, []);

  useEffect(() => {
    async function loadLanes() {
      if (!selectedHeatId) {
        setLanes([]);
        return;
      }
      const supabase = createClient();
      const [{ data: assignments }, { data: publicRows }] = await Promise.all([
        supabase.from("heat_assignments").select("id, lane_number").eq("heat_id", selectedHeatId),
        supabase
          .from("public_heat_sheet")
          .select("lane_number, display_name")
          .eq("heat_id", selectedHeatId),
      ]);
      const nameByLane = new Map((publicRows ?? []).map((r) => [r.lane_number, r.display_name]));
      const result: Lane[] = (assignments ?? [])
        .map((a) => ({
          heatAssignmentId: a.id,
          laneNumber: a.lane_number,
          displayName: nameByLane.get(a.lane_number) ?? "Unnamed",
        }))
        .sort((a, b) => a.laneNumber - b.laneNumber);
      setLanes(result);
      setValues({});
      setSavedLanes(new Set());
    }
    loadLanes();
  }, [selectedHeatId]);

  const selectedHeat = heats.find((h) => h.heatId === selectedHeatId);

  async function submitLane(lane: Lane) {
    const rawValue = values[lane.heatAssignmentId];
    if (!rawValue) return;

    const valueRaw: Record<string, unknown> = {};
    if (selectedHeat?.scoringType === "time") valueRaw.time_seconds = Number(rawValue);
    else if (selectedHeat?.scoringType === "reps") valueRaw.reps = Number(rawValue);
    else valueRaw.load_kg = Number(rawValue);

    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heatAssignmentId: lane.heatAssignmentId,
        workoutId,
        valueRaw,
        clientSubmissionId: crypto.randomUUID(),
      }),
    });
    if (res.ok) {
      setSavedLanes((prev) => new Set(prev).add(lane.heatAssignmentId));
    }
  }

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-center">Score entry</h1>

      {heats.length === 0 ? (
        <p className="text-center text-ink/60 text-sm">
          No heats assigned to you yet — ask the organizer.
        </p>
      ) : (
        <>
          <select
            value={selectedHeatId}
            onChange={(e) => setSelectedHeatId(e.target.value)}
            className="w-full bg-white border border-ink/10 rounded-lg px-4 py-3 text-sm"
          >
            <option value="">Choose a heat…</option>
            {heats.map((h) => (
              <option key={h.heatId} value={h.heatId}>
                {h.divisionName} — Heat {h.heatNumber}
              </option>
            ))}
          </select>

          {selectedHeatId && (
            <>
              <input
                type="text"
                value={workoutId}
                onChange={(e) => setWorkoutId(e.target.value)}
                placeholder="Workout label (e.g. WOD1)"
                className="w-full bg-white border border-ink/10 rounded-lg px-4 py-3 text-sm"
              />

              <div className="space-y-3">
                {lanes.map((lane) => (
                  <div
                    key={lane.heatAssignmentId}
                    className="bg-white border border-ink/10 rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-sm">Lane {lane.laneNumber}</p>
                      <p className="text-ink/60 text-sm">{lane.displayName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder={
                          selectedHeat?.scoringType === "time"
                            ? "seconds"
                            : selectedHeat?.scoringType === "reps"
                              ? "reps"
                              : "kg"
                        }
                        value={values[lane.heatAssignmentId] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [lane.heatAssignmentId]: e.target.value }))
                        }
                        className="w-24 border border-ink/10 rounded-lg px-2 py-2 text-sm"
                      />
                      <button
                        onClick={() => submitLane(lane)}
                        className="bg-accent text-white rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        {savedLanes.has(lane.heatAssignmentId) ? "Saved ✓" : "Save"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
