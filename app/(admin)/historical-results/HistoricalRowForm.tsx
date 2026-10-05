"use client";

import { useState } from "react";
import { GymPicker } from "@/components/GymPicker";

export function HistoricalRowForm({
  id,
  initialAthleteName,
  initialAthleteEmail,
  initialGymName,
  action,
}: {
  id: string;
  initialAthleteName: string;
  initialAthleteEmail: string | null;
  initialGymName: string | null;
  action: (formData: FormData) => void;
}) {
  const [gym, setGym] = useState(initialGymName ?? "");
  return (
    <form action={action} className="flex items-center gap-2 flex-wrap">
      <input type="hidden" name="id" value={id} />
      <input
        type="text"
        name="athleteName"
        defaultValue={initialAthleteName}
        className="w-32 bg-paper rounded px-2 py-1 text-xs border border-ink/10 focus:outline-none focus:border-accent"
      />
      <input
        type="email"
        name="athleteEmail"
        defaultValue={initialAthleteEmail ?? ""}
        className="w-40 bg-paper rounded px-2 py-1 text-xs font-data border border-ink/10 focus:outline-none focus:border-accent"
      />
      <div className="w-40">
        <GymPicker
          value={gym}
          onChange={setGym}
          placeholder="Gym"
          name="gymName"
          commitTypedValue
        />
      </div>
      <button type="submit" className="text-xs text-accent hover:underline whitespace-nowrap">
        Save
      </button>
    </form>
  );
}

export function HistoricalAddGymField() {
  const [gym, setGym] = useState("");
  return (
    <GymPicker
      value={gym}
      onChange={setGym}
      placeholder="Start typing a gym…"
      name="gymName"
      commitTypedValue
    />
  );
}
