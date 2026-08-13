"use client";

import { useState, useTransition } from "react";

export function MoveDivisionField({
  registrationId,
  eventId,
  divisionId,
  otherDivisions,
  action,
}: {
  registrationId: string;
  eventId: string;
  divisionId: string;
  otherDivisions: Array<{ id: string; name: string }>;
  action: (formData: FormData) => Promise<{ success: boolean }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(otherDivisions[0]?.id ?? "");
  const [failed, setFailed] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setTarget(otherDivisions[0]?.id ?? "");
          setFailed(false);
          setEditing(true);
        }}
        className="ml-2 text-xs text-accent hover:underline"
      >
        Move division
      </button>
    );
  }

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        autoFocus
        className="bg-paper rounded px-2 py-1 text-xs border border-ink/10 focus:outline-none focus:border-accent"
      >
        {otherDivisions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={isPending || !target}
        onClick={() => {
          const formData = new FormData();
          formData.set("registrationId", registrationId);
          formData.set("eventId", eventId);
          formData.set("divisionId", divisionId);
          formData.set("targetDivisionId", target);
          startTransition(async () => {
            const result = await action(formData);
            if (result.success) {
              setEditing(false);
            } else {
              setFailed(true);
            }
          });
        }}
        className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
      >
        {isPending ? "Moving…" : "Move"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setEditing(false)}
        className="text-xs text-ink/40 hover:text-ink/70 disabled:opacity-50"
      >
        Cancel
      </button>
      {failed && <span className="text-red-700 text-xs font-semibold">Failed — try again</span>}
    </span>
  );
}
