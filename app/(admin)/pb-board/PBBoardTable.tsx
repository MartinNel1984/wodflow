"use client";

import { useMemo, useState } from "react";
import { PB_LIFTS, formatPbValue, pbLiftByKey } from "@/lib/pbLifts";

type PbBoardRow = {
  profile_id: string;
  full_name: string;
  gender: string | null;
  lift_key: string;
  value_numeric: number;
  achieved_date: string;
};

export default function PBBoardTable({ rows }: { rows: PbBoardRow[] }) {
  const [liftKey, setLiftKey] = useState<string>(PB_LIFTS[0].key);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");

  const lift = pbLiftByKey(liftKey)!;

  const filtered = useMemo(() => {
    return rows
      .filter((r) => r.lift_key === liftKey)
      .filter((r) => gender === "all" || r.gender === gender)
      .sort((a, b) =>
        lift.unit === "time" ? a.value_numeric - b.value_numeric : b.value_numeric - a.value_numeric
      );
  }, [rows, liftKey, gender, lift.unit]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={liftKey}
          onChange={(e) => setLiftKey(e.target.value)}
          className="bg-white border border-ink/10 rounded-lg px-3 py-2 text-sm font-semibold"
        >
          {PB_LIFTS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <div className="flex text-xs border border-ink/10 rounded-lg overflow-hidden">
          {(["all", "male", "female"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`px-3 py-2 font-semibold capitalize ${
                gender === g ? "bg-accent text-white" : "bg-white text-ink/60"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink/5 text-left">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Athlete</th>
              <th className="px-4 py-2 text-right">{lift.label}</th>
              <th className="px-4 py-2 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.profile_id} className="border-t border-ink/10">
                <td className="px-4 py-2 font-data font-bold text-accent">{i + 1}</td>
                <td className="px-4 py-2">
                  {r.full_name}
                  {!r.gender && <span className="ml-2 text-ink/40 text-xs">no gender set</span>}
                </td>
                <td className="px-4 py-2 text-right font-data font-bold">
                  {formatPbValue(lift.unit, r.value_numeric)}
                </td>
                <td className="px-4 py-2 text-right text-ink/50">
                  {new Date(r.achieved_date).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink/60 text-sm">
                  No PBs logged for this lift yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
