"use client";

import { useState, useTransition } from "react";

export type MissingWaiverRow = {
  athleteId: string;
  fullName: string;
  email: string;
  teamName: string | null;
  eventName: string;
  divisionName: string;
  isCaptain: boolean;
};

// Compact "who still needs a waiver" list at the top of the Athletes
// page — a chase-list for the days before an event. Each row can be
// nudged individually so the organizer stays in control of who gets
// which email; there is no bulk send button to prevent a runaway blast
// after a data mistake. The captain-mismatch rows are shown separately
// because they weren't reset by the cleanup: the captain IS legally
// the one who signed, but the name they typed doesn't match their
// listed full_name (often a team-name typed in the signature box) and
// deserves a human check before any action.
export default function MissingWaiversPanel({
  unsigned,
  captainMismatches,
  resendAction,
}: {
  unsigned: MissingWaiverRow[];
  captainMismatches: (MissingWaiverRow & { signedName: string })[];
  resendAction: (formData: FormData) => Promise<{ sent: boolean }>;
}) {
  if (unsigned.length === 0 && captainMismatches.length === 0) return null;
  return (
    <div className="space-y-4">
      {unsigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="font-semibold text-sm text-amber-800">
            Missing waivers — {unsigned.length} teammate{unsigned.length === 1 ? "" : "s"}
          </p>
          <p className="text-amber-700 text-xs">
            Each teammate must sign their own waiver via their invite link before event day.
          </p>
          <ul className="divide-y divide-amber-200">
            {unsigned.map((r) => (
              <MissingRow key={r.athleteId} row={r} resendAction={resendAction} />
            ))}
          </ul>
        </div>
      )}

      {captainMismatches.length > 0 && (
        <details className="bg-white border border-ink/10 rounded-xl">
          <summary className="px-4 py-3 font-semibold cursor-pointer text-ink/70 text-sm">
            Review — {captainMismatches.length} captain{captainMismatches.length === 1 ? "" : "s"} whose waiver signature name looks off
          </summary>
          <div className="border-t border-ink/10 p-4 space-y-2 text-sm">
            <p className="text-ink/60 text-xs">
              Captain rows where the typed signature doesn&apos;t match the captain&apos;s listed name.
              Often a team name in the signature box; sometimes the wrong person signing. Nothing was
              auto-cleared here — verify with the captain and reset manually if needed.
            </p>
            <ul className="divide-y divide-ink/10">
              {captainMismatches.map((r) => (
                <li key={r.athleteId} className="py-2">
                  <p>
                    <span className="font-semibold">{r.fullName}</span>{" "}
                    <span className="text-ink/50">signed as &ldquo;{r.signedName}&rdquo;</span>
                  </p>
                  <p className="text-ink/50 text-xs">
                    {r.eventName} · {r.divisionName}
                    {r.teamName ? ` · ${r.teamName}` : ""} · {r.email}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}

function MissingRow({
  row,
  resendAction,
}: {
  row: MissingWaiverRow;
  resendAction: (formData: FormData) => Promise<{ sent: boolean }>;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "failed">("idle");

  return (
    <li className="py-2 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm">
          <span className="font-semibold">{row.fullName}</span>{" "}
          <span className="text-ink/50 text-xs">— {row.email}</span>
        </p>
        <p className="text-ink/50 text-xs">
          {row.eventName} · {row.divisionName}
          {row.teamName ? ` · ${row.teamName}` : ""}
        </p>
      </div>
      <form
        action={(fd) => {
          startTransition(async () => {
            const res = await resendAction(fd);
            setStatus(res.sent ? "sent" : "failed");
          });
        }}
      >
        <input type="hidden" name="athleteId" value={row.athleteId} />
        <button
          type="submit"
          disabled={pending || status === "sent"}
          className="bg-accent text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {status === "sent"
            ? "✓ Sent"
            : status === "failed"
              ? "Retry send"
              : pending
                ? "Sending…"
                : "Send waiver link"}
        </button>
      </form>
    </li>
  );
}
