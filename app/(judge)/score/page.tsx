"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enqueueScore, syncPendingScores, getAllPending, type PendingScore } from "@/lib/offline-queue";
import { parseTime } from "@/lib/scoring";
import { setHeatStatus } from "./actions";

type HeatOption = {
  heatId: string;
  heatNumber: number;
  divisionId: string;
  divisionName: string;
  scoringType: "time" | "reps" | "load";
  status: "scheduled" | "in_progress" | "completed";
};

type Workout = {
  id: string;
  name: string;
  scoringType: "time" | "reps";
  tiebreakEnabled: boolean;
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
      workoutRefId: item.workoutRefId,
      rxOrScaled: item.rxOrScaled,
      tiebreakValue: item.tiebreakValue,
      valueRaw: item.valueRaw,
      clientSubmissionId: item.clientSubmissionId,
    }),
  });
}

export default function ScorePage() {
  const [role, setRole] = useState<string>("");
  const [heats, setHeats] = useState<HeatOption[]>([]);
  const [selectedHeatId, setSelectedHeatId] = useState("");
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState("");
  const [freeTextWorkoutId, setFreeTextWorkoutId] = useState("WOD1");
  const [values, setValues] = useState<Record<string, string>>({});
  const [tiebreakValues, setTiebreakValues] = useState<Record<string, string>>({});
  const [rxScaledByLane, setRxScaledByLane] = useState<Record<string, "rx" | "scaled">>({});
  // For time-scored divisions: whether the judge is recording a finish
  // time or a rep count for an athlete who was capped out before finishing.
  const [modeByLane, setModeByLane] = useState<Record<string, "finished" | "capped">>({});
  const [savedLanes, setSavedLanes] = useState<Set<string>>(new Set());
  const [confirmingLanes, setConfirmingLanes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const isPrivileged = role === "head_judge" || role === "organizer";

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

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const userRole = profile?.role ?? "judge";
      setRole(userRole);

      // Centralized-mode head_judge (or organizer, e.g. correcting) sees
      // every heat — heats are publicly readable so no extra join needed.
      // Distributed-mode judges only see heats they're assigned to.
      if (userRole === "head_judge" || userRole === "organizer") {
        const { data: heatRows } = await supabase
          .from("heats")
          .select("id, heat_number, status, division_id, divisions(name, workout_scoring_type)")
          .order("heat_number", { ascending: true });
        setHeats(mapHeatRows(heatRows ?? []));
        setLoading(false);
        return;
      }

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
        .select("id, heat_number, status, division_id, divisions(name, workout_scoring_type)")
        .in("id", heatIds);
      setHeats(mapHeatRows(heatRows ?? []));
      setLoading(false);
    }

    type HeatRow = {
      id: string;
      heat_number: number;
      status: HeatOption["status"];
      division_id: string;
      divisions: { name: string; workout_scoring_type: string } | { name: string; workout_scoring_type: string }[] | null;
    };

    function mapHeatRows(rows: HeatRow[]): HeatOption[] {
      return rows.map((h) => {
        const div = Array.isArray(h.divisions) ? h.divisions[0] : h.divisions;
        return {
          heatId: h.id,
          heatNumber: h.heat_number,
          divisionId: h.division_id,
          divisionName: div?.name ?? "Division",
          scoringType: (div?.workout_scoring_type ?? "time") as HeatOption["scoringType"],
          status: h.status,
        };
      });
    }

    loadHeats();
  }, []);

  useEffect(() => {
    async function loadLanesAndWorkouts() {
      if (!selectedHeatId) {
        setLanes([]);
        setWorkouts([]);
        return;
      }
      const heat = heats.find((h) => h.heatId === selectedHeatId);
      const supabase = createClient();
      const [{ data: assignments }, { data: publicRows }, { data: workoutRows }] = await Promise.all([
        supabase.from("heat_assignments").select("id, lane_number").eq("heat_id", selectedHeatId),
        supabase
          .from("public_heat_sheet")
          .select("lane_number, display_name")
          .eq("heat_id", selectedHeatId),
        heat
          ? supabase
              .from("workouts")
              .select("id, name, sequence, scoring_type, tiebreak_enabled")
              .eq("division_id", heat.divisionId)
              .order("sequence", { ascending: true })
          : Promise.resolve({ data: [] as never[] }),
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
      setTiebreakValues({});
      setSavedLanes(new Set());

      const mappedWorkouts: Workout[] = (workoutRows ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        scoringType: w.scoring_type,
        tiebreakEnabled: w.tiebreak_enabled,
      }));
      setWorkouts(mappedWorkouts);
      setSelectedWorkoutId(mappedWorkouts[0]?.id ?? "");
    }
    loadLanesAndWorkouts();
    // heats intentionally omitted — only re-run when the selected heat changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHeatId]);

  // Server actions' revalidatePath only affects server-rendered
  // content — this whole page fetches client-side on mount, so a lock/
  // unlock needs to update local state directly or the status shown
  // here would silently drift from the real DB value until a reload.
  async function toggleHeatLock() {
    if (!selectedHeatId) return;
    const nextStatus = heatLocked ? "in_progress" : "completed";
    const fd = new FormData();
    fd.set("heatId", selectedHeatId);
    fd.set("status", nextStatus);
    await setHeatStatus(fd);
    setHeats((prev) =>
      prev.map((h) => (h.heatId === selectedHeatId ? { ...h, status: nextStatus } : h))
    );
  }

  const selectedHeat = heats.find((h) => h.heatId === selectedHeatId);
  const selectedWorkout = workouts.find((w) => w.id === selectedWorkoutId);
  const tiebreakEnabled = selectedWorkout?.tiebreakEnabled ?? false;
  const heatLocked = selectedHeat?.status === "completed";

  function parseValueForType(raw: string, scoringType: string, mode: "finished" | "capped") {
    if (scoringType === "time") {
      if (mode === "capped") return { reps: Number(raw) };
      const seconds = parseTime(raw);
      return seconds == null ? null : { time_seconds: seconds };
    }
    if (scoringType === "reps") return { reps: Number(raw) };
    return { load_kg: Number(raw) };
  }

  async function submitLane(lane: Lane) {
    const rawValue = values[lane.heatAssignmentId];
    if (!rawValue) return;

    const mode = modeByLane[lane.heatAssignmentId] ?? "finished";
    const valueRaw = parseValueForType(rawValue, selectedHeat?.scoringType ?? "time", mode);
    if (!valueRaw) return;

    // Correcting a locked heat needs a deliberate second tap, not a
    // silent overwrite — this is a UX guard on top of the DB, which
    // already allows head_judge/organizer to insert past the lock.
    if (heatLocked && isPrivileged && !confirmingLanes.has(lane.heatAssignmentId)) {
      setConfirmingLanes((prev) => new Set(prev).add(lane.heatAssignmentId));
      return;
    }

    let tiebreakValue: Record<string, unknown> | null = null;
    if (tiebreakEnabled) {
      const rawTiebreak = tiebreakValues[lane.heatAssignmentId];
      if (rawTiebreak) {
        tiebreakValue = parseValueForType(rawTiebreak, selectedHeat?.scoringType ?? "time", "finished");
      }
    }

    // Write to the local queue first and show "Saved" immediately — the
    // UI never blocks on network. Sync happens in the background.
    await enqueueScore({
      heatAssignmentId: lane.heatAssignmentId,
      workoutId: selectedWorkout?.name ?? freeTextWorkoutId,
      workoutRefId: selectedWorkout?.id ?? null,
      rxOrScaled: rxScaledByLane[lane.heatAssignmentId] ?? "rx",
      tiebreakValue,
      valueRaw,
    });
    setSavedLanes((prev) => new Set(prev).add(lane.heatAssignmentId));
    setConfirmingLanes((prev) => {
      const next = new Set(prev);
      next.delete(lane.heatAssignmentId);
      return next;
    });
    await refreshPendingCount();
    trySync();
  }

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-center">
        {isPrivileged ? "Score entry (Head Judge)" : "Score entry"}
      </h1>

      {pendingCount > 0 && (
        <p className="text-center text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          {pendingCount} score{pendingCount === 1 ? "" : "s"} saved locally, syncing…
        </p>
      )}

      {heats.length === 0 ? (
        <p className="text-center text-ink/60 text-sm">
          {isPrivileged ? "No heats generated yet." : "No heats assigned to you yet — ask the organizer."}
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
                {h.divisionName} — Heat {h.heatNumber} {h.status === "completed" ? "(locked)" : ""}
              </option>
            ))}
          </select>

          {selectedHeatId && (
            <>
              {isPrivileged && (
                <div className="bg-white border border-ink/10 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-ink/50">
                    Heat status: <strong className="text-ink">{selectedHeat?.status}</strong>
                  </span>
                  <button type="button" onClick={toggleHeatLock} className="text-xs font-semibold text-accent">
                    {heatLocked ? "Unlock heat" : "Lock heat (end scoring)"}
                  </button>
                </div>
              )}

              {workouts.length > 0 ? (
                <select
                  value={selectedWorkoutId}
                  onChange={(e) => setSelectedWorkoutId(e.target.value)}
                  className="w-full bg-white border border-ink/10 rounded-lg px-4 py-3 text-sm"
                >
                  {workouts.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={freeTextWorkoutId}
                  onChange={(e) => setFreeTextWorkoutId(e.target.value)}
                  placeholder="Workout label (e.g. WOD1)"
                  className="w-full bg-white border border-ink/10 rounded-lg px-4 py-3 text-sm"
                />
              )}

              <div className="space-y-3">
                {lanes.map((lane, i) => (
                  <div
                    key={lane.heatAssignmentId}
                    className="bg-white border border-ink/10 rounded-xl p-4 space-y-3 animate-settle-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-data font-bold text-sm text-accent">Lane {lane.laneNumber}</p>
                        <p className="text-ink/60 text-sm">{lane.displayName}</p>
                      </div>
                      <div className="flex text-xs border border-ink/10 rounded-lg overflow-hidden">
                        {(["rx", "scaled"] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setRxScaledByLane((prev) => ({ ...prev, [lane.heatAssignmentId]: opt }))
                            }
                            className={`px-2 py-1 ${
                              (rxScaledByLane[lane.heatAssignmentId] ?? "rx") === opt
                                ? "bg-accent text-white"
                                : "bg-white text-ink/60"
                            }`}
                          >
                            {opt === "rx" ? "RX" : "Scaled"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
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
                      <div className="flex items-center gap-2 ml-auto">
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
                          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                            confirmingLanes.has(lane.heatAssignmentId)
                              ? "bg-amber-500 text-white"
                              : "bg-accent text-white"
                          }`}
                        >
                          {savedLanes.has(lane.heatAssignmentId)
                            ? "Saved ✓"
                            : confirmingLanes.has(lane.heatAssignmentId)
                              ? "Locked — confirm?"
                              : "Save"}
                        </button>
                      </div>
                    </div>

                    {tiebreakEnabled && (
                      <div className="flex items-center justify-between gap-3 border-t border-ink/5 pt-2">
                        <span className="text-xs text-ink/50">Tiebreak</span>
                        <input
                          type="text"
                          placeholder={selectedHeat?.scoringType === "time" ? "mm:ss" : "reps"}
                          value={tiebreakValues[lane.heatAssignmentId] ?? ""}
                          onChange={(e) =>
                            setTiebreakValues((prev) => ({ ...prev, [lane.heatAssignmentId]: e.target.value }))
                          }
                          className="w-24 border border-ink/10 rounded-lg px-2 py-2 text-sm"
                        />
                      </div>
                    )}
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
