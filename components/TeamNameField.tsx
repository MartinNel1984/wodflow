"use client";

import { useState, useTransition } from "react";

export function TeamNameField({
  registrationId,
  eventId,
  divisionId,
  teamName,
  action,
}: {
  registrationId: string;
  eventId: string;
  divisionId: string;
  teamName: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(teamName ?? "");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="ml-2 text-xs text-accent hover:underline"
      >
        {teamName ? "Rename team" : "Set team name"}
      </button>
    );
  }

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        className="bg-paper rounded px-2 py-1 text-xs border border-ink/10 focus:outline-none focus:border-accent"
      />
      <button
        type="button"
        disabled={isPending || !value.trim()}
        onClick={() => {
          const formData = new FormData();
          formData.set("registrationId", registrationId);
          formData.set("eventId", eventId);
          formData.set("divisionId", divisionId);
          formData.set("teamName", value.trim());
          startTransition(async () => {
            await action(formData);
            setEditing(false);
          });
        }}
        className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(teamName ?? "");
          setEditing(false);
        }}
        className="text-xs text-ink/40 hover:text-ink/70"
      >
        Cancel
      </button>
    </span>
  );
}
