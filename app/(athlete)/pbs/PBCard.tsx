"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type PbLift,
  formatPbValue,
  parseTimeToSeconds,
  secondsToMinutesAndSeconds,
} from "@/lib/pbLifts";

type PbEntry = {
  id: string;
  lift_key: string;
  value_numeric: number;
  achieved_date: string;
  created_at: string;
};

type Ranking = {
  my_best_value: number;
  my_best_date: string;
  athlete_rank: number;
  total_athletes: number;
} | null;

export default function PBCard({
  lift,
  profileId,
  entries,
  ranking,
}: {
  lift: PbLift;
  profileId: string;
  entries: PbEntry[];
  ranking: Ranking;
}) {
  const [rows, setRows] = useState(entries);
  const [showHistory, setShowHistory] = useState(false);
  const [formOpen, setFormOpen] = useState<"add" | string | null>(null); // "add" or an entry id being edited
  const [kgOrReps, setKgOrReps] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const best = rows[0] ?? null;

  function openAdd() {
    setKgOrReps("");
    setMinutes("");
    setSeconds("");
    setDate(new Date().toISOString().slice(0, 10));
    setError("");
    setFormOpen("add");
  }

  function openEdit(entry: PbEntry) {
    if (lift.unit === "time") {
      const { minutes: m, seconds: s } = secondsToMinutesAndSeconds(entry.value_numeric);
      setMinutes(String(m));
      setSeconds(String(s));
    } else {
      setKgOrReps(String(entry.value_numeric));
    }
    setDate(entry.achieved_date);
    setError("");
    setFormOpen(entry.id);
  }

  function closeForm() {
    setFormOpen(null);
  }

  function valueFromForm(): number | null {
    if (lift.unit === "time") {
      const m = parseInt(minutes, 10);
      const s = parseInt(seconds, 10);
      if (isNaN(m) || isNaN(s) || m < 0 || s < 0 || s > 59) return null;
      const total = parseTimeToSeconds(m, s);
      return total > 0 ? total : null;
    }
    const n = parseFloat(kgOrReps);
    return isNaN(n) || n <= 0 ? null : n;
  }

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    const value = valueFromForm();
    if (value === null) {
      setError("Enter a valid value.");
      return;
    }
    if (!date) {
      setError("Pick a date.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    if (formOpen === "add") {
      const { data, error: insertError } = await supabase
        .from("athlete_pbs")
        .insert({ profile_id: profileId, lift_key: lift.key, value_numeric: value, achieved_date: date })
        .select("id, lift_key, value_numeric, achieved_date, created_at")
        .single();
      setSaving(false);
      if (insertError || !data) {
        setError(insertError?.message ?? "Could not save.");
        return;
      }
      setRows((prev) => [data, ...prev].sort((a, b) => b.achieved_date.localeCompare(a.achieved_date)));
    } else if (formOpen) {
      const { error: updateError } = await supabase
        .from("athlete_pbs")
        .update({ value_numeric: value, achieved_date: date })
        .eq("id", formOpen);
      setSaving(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setRows((prev) =>
        prev
          .map((r) => (r.id === formOpen ? { ...r, value_numeric: value, achieved_date: date } : r))
          .sort((a, b) => b.achieved_date.localeCompare(a.achieved_date))
      );
    }
    closeForm();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this PB entry?")) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("athlete_pbs").delete().eq("id", id);
    if (deleteError) {
      alert(deleteError.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="bg-white text-ink border-2 border-ink rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{lift.label}</p>
          {best ? (
            <p className="font-data font-bold text-xl text-accent">
              {formatPbValue(lift.unit, best.value_numeric)}
              <span className="text-ink/40 font-normal text-xs ml-2">
                {new Date(best.achieved_date).toLocaleDateString()}
              </span>
            </p>
          ) : (
            <p className="text-ink/50 text-sm">No PB logged yet</p>
          )}
        </div>
        {best && ranking && (
          <p className="text-ink/60 text-xs text-right">
            ATG rank
            <br />
            <span className="font-semibold text-ink">
              {ranking.athlete_rank} / {ranking.total_athletes}
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <button type="button" onClick={openAdd} className="text-accent hover:underline font-semibold">
          + Add a PB
        </button>
        {rows.length > 0 && (
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-ink/50 hover:text-ink">
            {showHistory ? "Hide progression" : "Show progression"}
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={saveEntry} className="bg-paper rounded-lg p-3 space-y-2 border border-ink/10">
          <div className="flex items-end gap-2">
            {lift.unit === "time" ? (
              <>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">Min</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="w-16 bg-white rounded-lg px-2 py-1.5 text-sm border border-ink/10 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">Sec</label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    required
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value)}
                    className="w-16 bg-white rounded-lg px-2 py-1.5 text-sm border border-ink/10 focus:outline-none focus:border-accent"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">
                  {lift.unit === "kg" ? "Weight (kg)" : "Reps"}
                </label>
                <input
                  type="number"
                  min={0}
                  step={lift.unit === "kg" ? "0.5" : "1"}
                  required
                  value={kgOrReps}
                  onChange={(e) => setKgOrReps(e.target.value)}
                  className="w-24 bg-white rounded-lg px-2 py-1.5 text-sm border border-ink/10 focus:outline-none focus:border-accent"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1">Date</label>
              <input
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white rounded-lg px-2 py-1.5 text-sm border border-ink/10 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          {error && <p className="text-red-700 text-xs">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-accent text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={closeForm} className="text-ink/50 hover:text-ink text-xs">
              Cancel
            </button>
          </div>
        </form>
      )}

      {showHistory && rows.length > 0 && (
        <div className="divide-y divide-ink/5 border-t border-ink/10 pt-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-1.5 text-sm">
              <span>
                {formatPbValue(lift.unit, r.value_numeric)}{" "}
                <span className="text-ink/40 text-xs">{new Date(r.achieved_date).toLocaleDateString()}</span>
              </span>
              <span className="flex items-center gap-2 text-xs">
                <button type="button" onClick={() => openEdit(r)} className="text-accent hover:underline">
                  Edit
                </button>
                <button type="button" onClick={() => deleteEntry(r.id)} className="text-red-700 hover:underline">
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
