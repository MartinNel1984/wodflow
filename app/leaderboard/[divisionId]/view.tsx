"use client";

import { Fragment, useState } from "react";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { RumbleBackdrop } from "@/components/RumbleBackdrop";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";
import type { Standing, WorkoutResult } from "@/lib/leaderboard";

export default function LeaderboardView({
  divisionName,
  standings,
  workouts,
  brandKit,
  teamMembers,
  eventStartDate,
  eventEndDate,
}: {
  divisionName: string;
  standings: Standing[];
  workouts: { id: string; name: string; results: WorkoutResult[] }[];
  brandKit?: BrandKit | null;
  teamMembers?: Record<string, string[]>;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
}) {
  const [view, setView] = useState<string>("overall");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const selectedWorkout = workouts.find((w) => w.id === view);
  const isBigOne = brandKit?.name === "Rumble Big One";

  function toggleExpanded(registrationId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(registrationId)) next.delete(registrationId);
      else next.add(registrationId);
      return next;
    });
  }

  // A team name is clickable to reveal its roster; a solo athlete's
  // "team" is just themselves, so nothing to expand into.
  function NameCell({ registrationId, displayName, className }: { registrationId: string; displayName: string; className?: string }) {
    const members = teamMembers?.[registrationId];
    if (!members || members.length < 2) {
      return <span className={className}>{displayName}</span>;
    }
    return (
      <button
        type="button"
        onClick={() => toggleExpanded(registrationId)}
        className={`${className ?? ""} underline decoration-dotted underline-offset-2 text-left`}
      >
        {displayName}
      </button>
    );
  }

  const content = (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6" style={brandKitStyle(brandKit)}>
      <div className="text-center">
        <div className="text-lg font-semibold opacity-70">
          <BrandKitLogo kit={brandKit} />
        </div>
        <h1 className="text-2xl font-semibold">{divisionName}</h1>
      </div>

      {workouts.length === 0 ? (
        <NotLiveYet startDate={eventStartDate} endDate={eventEndDate} />
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
                  {w.name}
                </option>
              ))}
            </select>
          )}

          {selectedWorkout ? (
            <div className="overflow-x-auto rounded-xl border border-ink/10">
            <table className="w-full bg-white text-sm">
              <thead>
                <tr className="bg-ink/5 text-left">
                  <th className="px-4 py-2">Pos</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Time / Reps / Weight</th>
                  <th className="px-4 py-2 text-right">Points</th>
                  <th className="px-4 py-2 text-right">Tiebreak</th>
                </tr>
              </thead>
              <tbody>
                {selectedWorkout.results.map((r) => (
                  <Fragment key={r.registrationId}>
                    <tr className="border-t border-ink/10">
                      <td className="px-4 py-2 font-data font-bold text-accent">{r.position}</td>
                      <td className="px-4 py-2">
                        <NameCell registrationId={r.registrationId} displayName={r.displayName} />
                      </td>
                      <td className="px-4 py-2 text-right font-data">{r.display}</td>
                      <td className="px-4 py-2 text-right font-data">{r.points}</td>
                      <td className="px-4 py-2 text-right font-data text-ink/50">
                        {r.tiebreakDisplay ?? "—"}
                      </td>
                    </tr>
                    {expanded.has(r.registrationId) && teamMembers?.[r.registrationId] && (
                      <tr className="border-t border-ink/10 bg-ink/5">
                        <td />
                        <td className="px-4 py-2 text-xs text-ink/60" colSpan={4}>
                          {teamMembers[r.registrationId].join(" · ")}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-ink/10">
            <table className="w-full bg-white text-sm">
              <thead>
                <tr className="bg-ink/5 text-left">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Name</th>
                  {workouts.map((w) => (
                    <th key={w.id} className="px-4 py-2 text-right">
                      {w.name}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => {
                  // Medal and highlight follow s.place, not row index, so
                  // a tie for first shows two golds rather than a gold
                  // and a silver for identical totals.
                  const medal = ["🥇", "🥈", "🥉"][s.place - 1];
                  return (
                    <Fragment key={s.registrationId}>
                      <tr
                        className={`border-t border-ink/10 animate-settle-in ${
                          s.place === 1 ? "bg-accent/10" : ""
                        }`}
                        style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                      >
                        <td className="px-4 py-2 font-data font-bold text-accent text-lg">
                          {medal ?? s.place}
                        </td>
                        <td className="px-4 py-2">
                          <NameCell
                            registrationId={s.registrationId}
                            displayName={s.displayName}
                            className={s.place === 1 ? "font-semibold" : ""}
                          />
                        </td>
                        {workouts.map((w) => {
                          const score = s.workoutScores[w.id];
                          return (
                            <td key={w.id} className="px-4 py-2 text-right font-data text-ink/70 whitespace-nowrap">
                              {score ? (
                                <>
                                  <div>{score.display}</div>
                                  <div className="text-xs text-ink/40">#{score.position}</div>
                                  <div className="text-xs text-ink/40">{score.points}pts</div>
                                  <div className="text-xs text-ink/40">
                                    {score.tiebreakDisplay ? `TB ${score.tiebreakDisplay}` : " "}
                                  </div>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-right font-data font-bold">{s.totalPoints}</td>
                      </tr>
                      {expanded.has(s.registrationId) && teamMembers?.[s.registrationId] && (
                        <tr className="border-t border-ink/10 bg-ink/5">
                          <td />
                          <td className="px-4 py-2 text-xs text-ink/60" colSpan={workouts.length + 2}>
                            {teamMembers[s.registrationId].join(" · ")}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
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
        useHistoryBack
      >
        <div className="w-full max-w-2xl bg-white text-ink rounded-2xl shadow-xl">{content}</div>
      </RumbleBackdrop>
    );
  }

  return content;
}

// Replaces the old flat "No scores yet." with a message that actually
// explains why — an athlete clicking through from the portal picker to
// an event weeks out shouldn't read a blank leaderboard as broken.
function NotLiveYet({ startDate, endDate }: { startDate?: string | null; endDate?: string | null }) {
  if (!startDate) {
    return <p className="text-center text-ink/60 text-sm">No scores yet.</p>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const formatted = new Date(startDate + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
  });

  if (today < startDate) {
    const daysAway = Math.ceil(
      (new Date(startDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return (
      <div className="text-center space-y-1">
        <p className="text-ink/70 text-sm font-semibold">Leaderboard opens {formatted}</p>
        <p className="text-ink/50 text-xs">
          {daysAway === 0 ? "Today" : daysAway === 1 ? "1 day to go" : `${daysAway} days to go`}
        </p>
      </div>
    );
  }

  if (!endDate || today <= endDate) {
    return <p className="text-center text-ink/60 text-sm">Event&apos;s underway — scores will appear here as they&apos;re entered.</p>;
  }

  return <p className="text-center text-ink/60 text-sm">No scores yet.</p>;
}
