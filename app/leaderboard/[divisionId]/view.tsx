"use client";

import { useState } from "react";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";
import type { Standing, WorkoutResult } from "@/lib/leaderboard";

export default function LeaderboardView({
  divisionName,
  standings,
  workouts,
  brandKit,
}: {
  divisionName: string;
  standings: Standing[];
  workouts: { id: string; results: WorkoutResult[] }[];
  brandKit?: BrandKit | null;
}) {
  const [view, setView] = useState<string>("overall");
  const selectedWorkout = workouts.find((w) => w.id === view);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6" style={brandKitStyle(brandKit)}>
      <div className="text-center">
        <div className="text-lg font-semibold opacity-70">
          <BrandKitLogo kit={brandKit} />
        </div>
        <h1 className="text-2xl font-semibold">{divisionName}</h1>
      </div>

      {workouts.length === 0 ? (
        <p className="text-center text-ink/60 text-sm">No scores yet.</p>
      ) : (
        <>
          {workouts.length > 1 && (
            <select
              value={view}
              onChange={(e) => setView(e.target.value)}
              className="w-full bg-white border border-ink/10 rounded-lg px-4 py-3 text-sm"
            >
              <option value="overall">Overall</option>
              {workouts.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id}
                </option>
              ))}
            </select>
          )}

          {selectedWorkout ? (
            <table className="w-full bg-white border border-ink/10 rounded-xl overflow-hidden text-sm">
              <thead>
                <tr className="bg-ink/5 text-left">
                  <th className="px-4 py-2">Pos</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Time / Reps</th>
                  <th className="px-4 py-2 text-right">Points</th>
                  <th className="px-4 py-2 text-right">Tiebreaker</th>
                </tr>
              </thead>
              <tbody>
                {selectedWorkout.results.map((r) => (
                  <tr key={r.registrationId} className="border-t border-ink/10">
                    <td className="px-4 py-2 font-data font-bold text-accent">{r.position}</td>
                    <td className="px-4 py-2">{r.displayName}</td>
                    <td className="px-4 py-2 text-right font-data">{r.display}</td>
                    <td className="px-4 py-2 text-right font-data">{r.points}</td>
                    <td className="px-4 py-2 text-right font-data text-ink/50">
                      {r.capped ? r.display : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <tr
                    key={s.registrationId}
                    className="border-t border-ink/10 animate-settle-in"
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                  >
                    <td className="px-4 py-2 font-data font-bold text-accent">{i + 1}</td>
                    <td className="px-4 py-2">{s.displayName}</td>
                    <td className="px-4 py-2 text-right font-data">{s.totalPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
