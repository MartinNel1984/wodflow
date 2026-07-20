"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enqueueScore, syncPendingScores, getAllPending, type PendingScore } from "@/lib/offline-queue";
import { parseTime } from "@/lib/scoring";

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

async function submitPendingScore(item: PendingScore): Promise<Response> {
  return fetch("/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      heatAssignmentId: item.heatAssignmentId,
      workoutId: item.workoutId,
      valueRaw: item.valueRaw,
      clientSubmissionId: item.clientSubmissionId,
    }),
  });
}

export default function ScorePage() {
  const [heats, setHeats] = useState<HeatOption[]>([]);
  const [selectedHeatId, setSelectedHeatId] = useState("");
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [workoutId, setWorkoutId] = useState("WOD1");
  const [values, setValues] = useState<Record<string, string>>({});
  // For time-scored divisions: whether the judge is recording a finish
  // time or a rep count for an athlete who was capped out before finishing.
  const [modeByLane, setModeByLane] = useState<Record<string, "finished" | "capped">>({});
  const [savedLanes, setSavedLanes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    const pending = await getAllPending();
    setPendingCount(pending.length);
  }, []);

  const trySync = useCallback(async () => {
    await syncPendingScores(submitPendingScore);
    await refreshPendingCount();
  }, [refreshPendingCount]);

  // Sync triggers: on mount, on reconnect, on tab refocus, and a flat
  // 15s poll while there's a nonempty queue — a short, simple interval
  // is enough for an event-day window, no exponential backoff needed.
  useEffect(() => {
    // Kicking off an async sync on mount is the correct pattern here — the
    // setState calls inside trySync happen after a network round-trip, not
    // synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    trySync();
    const interval = setInterval(trySync, 15_000);
    window.addEventListener("online", trySync);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") trySync();
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", trySync);
    };
  }, [trySync]);

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
    if (selectedHeat?.scoringType === "time") {
      const mode = modeByLane[lane.heatAssignmentId] ?? "finished";
      if (mode === "capped") {
        valueRaw.reps = Number(rawValue);
      } else {
        const seconds = parseTime(rawValue);
        if (seconds == null) return;
        valueRaw.time_seconds = seconds;
      }
    } else if (selectedHeat?.scoringType === "reps") valueRaw.reps = Number(rawValue);
    else valueRaw.load_kg = Number(rawValue);

    // Write to the local queue first and show "Saved" immediately — the
    // UI never blocks on network. Sync happens in the background.
    await enqueueScore({ heatAssignmentId: lane.heatAssignmentId, workoutId, valueRaw });
    setSavedLanes((prev) => new Set(prev).add(lane.heatAssignmentId));
    await refreshPendingCount();
    trySync();
  }

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-center">Score entry</h1>

      {pendingCount > 0 && (
        <p className="text-center text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          {pendingCount} score{pendingCount === 1 ? "" : "s"} saved locally, syncing…
        </p>
      )}

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
                {lanes.map((lane, i) => (
                  <div
                    key={lane.heatAssignmentId}
                    className="bg-white border border-ink/10 rounded-xl p-4 flex items-center justify-between gap-3 animate-settle-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div>
                      <p className="font-data font-bold text-sm text-accent">Lane {lane.laneNumber}</p>
                      <p className="text-ink/60 text-sm">{lane.displayName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {selectedHeat?.scoringType === "time" && (
                        <div className="flex text-xs border border-ink/10 rounded-lg overflow-hidden">
                          {(["finished", "capped"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                setModeByLane((prev) => ({ ...prev, [lane.heatAssignmentId]: mode }))
                              }
                              className={`px-2 py-1 ${
                                (modeByLane[lane.heatAssignmentId] ?? "finished") === mode
                                  ? "bg-accent text-white"
                                  : "bg-white text-ink/60"
                              }`}
                            >
                              {mode === "finished" ? "Finished" : "Capped"}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type={selectedHeat?.scoringType === "time" && (modeByLane[lane.heatAssignmentId] ?? "finished") === "finished" ? "text" : "number"}
                          placeholder={
                            selectedHeat?.scoringType === "time"
                              ? (modeByLane[lane.heatAssignmentId] ?? "finished") === "finished"
                                ? "mm:ss"
                                : "reps"
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
