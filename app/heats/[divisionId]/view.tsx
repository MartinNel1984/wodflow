"use client";

import { useState } from "react";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { RumbleBackdrop } from "@/components/RumbleBackdrop";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";

type Heat = {
  heatId: string;
  heatNumber: number;
  startTime: string;
  lanes: { laneNumber: number; displayName: string }[];
};

type Workout = {
  id: string;
  name: string;
  heats: Heat[];
};

export default function HeatsView({
  divisionName,
  workouts,
  brandKit,
  isPreview,
}: {
  divisionName: string;
  workouts: Workout[];
  brandKit?: BrandKit | null;
  isPreview?: boolean;
}) {
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(workouts[0]?.id ?? "");
  const selectedWorkout = workouts.find((w) => w.id === selectedWorkoutId) ?? workouts[0];
  const isBigOne = brandKit?.name === "Rumble Big One";

  const content = (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6" style={brandKitStyle(brandKit)}>
      {isPreview && (
        <p className="text-center text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full px-3 py-1.5">
          🔒 Preview — hidden from athletes until you make results live
        </p>
      )}
      <div className="text-center">
        <div className="text-lg font-semibold opacity-70">
          <BrandKitLogo kit={brandKit} />
        </div>
        <h1 className="text-2xl font-semibold">{divisionName}</h1>
      </div>

      {workouts.length === 0 ? (
        <p className="text-center text-ink/60 text-sm">Heats haven&apos;t been published yet.</p>
      ) : (
        <>
          {workouts.length > 1 && (
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
          )}

          <div className="space-y-3">
            {selectedWorkout?.heats.map((heat, i) => (
              <div
                key={heat.heatId}
                className="bg-white border border-ink/10 rounded-xl p-4 animate-settle-in"
                style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
              >
                <p className="font-data font-bold text-accent mb-2">
                  Heat {heat.heatNumber} · {new Date(heat.startTime).toLocaleTimeString()}
                </p>
                <div className="space-y-1 text-sm">
                  {heat.lanes.map((lane) => (
                    <p key={lane.laneNumber}>
                      <span className="font-data text-ink/50">Lane {lane.laneNumber}</span> —{" "}
                      {lane.displayName ?? "Unnamed"}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {selectedWorkout && selectedWorkout.heats.length === 0 && (
              <p className="text-center text-ink/60 text-sm">No heats generated for this workout yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (isBigOne) {
    return (
      <RumbleBackdrop
        logoSrc={brandKit?.logo_url || "/rumble/series-logo-v2.png"}
        logoAlt={brandKit?.name || "Rumble Big One"}
        backHref="/"
      >
        <div className="w-full max-w-2xl bg-white text-ink rounded-2xl shadow-xl">{content}</div>
      </RumbleBackdrop>
    );
  }

  return content;
}
