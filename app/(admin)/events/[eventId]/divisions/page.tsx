import { createClient } from "@/lib/supabase/server";
import { createDivision, updateScoringConfig } from "./actions";
import type { ScoringConfig } from "@/lib/leaderboard";
import Link from "next/link";

export default async function DivisionsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: divisions }] = await Promise.all([
    supabase.from("events").select("name, default_price").eq("id", eventId).single(),
    supabase
      .from("divisions")
      .select("id, name, team_size, price_normal, lane_count, scoring_config")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <a href="/events" className="text-accent text-sm hover:underline">
          ← Events
        </a>
        <h1 className="text-2xl font-semibold mt-1">{event?.name ?? "Event"} — Divisions</h1>
      </div>

      <div className="space-y-3">
        {(divisions ?? []).map((d) => (
          <div key={d.id} className="bg-white border border-ink/10 rounded-xl p-4">
            <p className="font-semibold">{d.name}</p>
            <p className="text-ink/60 text-sm">
              {d.team_size === 1 ? "Individual" : `Team of ${d.team_size}`} · R{d.price_normal}
              {d.lane_count ? ` · ${d.lane_count} lanes` : ""}
            </p>
            <div className="flex gap-3 mb-3">
              <Link href={`/events/${eventId}/divisions/${d.id}/athletes`} className="text-accent text-xs hover:underline">
                Athletes
              </Link>
              <Link href={`/events/${eventId}/divisions/${d.id}/workouts`} className="text-accent text-xs hover:underline">
                Manage workouts
              </Link>
              <Link href={`/events/${eventId}/divisions/${d.id}/heats`} className="text-accent text-xs hover:underline">
                Manage heats
              </Link>
            </div>
            <form action={updateScoringConfig} className="flex items-center gap-2">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="divisionId" value={d.id} />
              <span className="text-xs text-ink/50">Scoring:</span>
              <select
                name="scoringMethod"
                defaultValue={(d.scoring_config as ScoringConfig | null)?.method ?? "rank_sum"}
                className="text-xs border border-ink/10 rounded-lg px-2 py-1"
              >
                <option value="rank_sum">Rank sum (entrants − position + 1)</option>
                <option value="gap_formula">Gap formula (100, decreasing gap)</option>
              </select>
              <button type="submit" className="text-xs text-accent font-semibold">
                Save
              </button>
            </form>
          </div>
        ))}
        {(!divisions || divisions.length === 0) && (
          <p className="text-ink/60 text-sm">No divisions yet — create one below.</p>
        )}
      </div>

      <form action={createDivision} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <h2 className="font-semibold">New division</h2>
        <Field label="Name" name="name" required />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Team size (1 = individual)" name="teamSize" type="number" defaultValue="1" />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              Scoring type
            </label>
            <select
              name="workoutScoringType"
              defaultValue="time"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10"
            >
              <option value="time">Time</option>
              <option value="reps">Reps</option>
              <option value="load">Load</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              Points formula
            </label>
            <select
              name="scoringMethod"
              defaultValue="rank_sum"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10"
            >
              <option value="rank_sum">Rank sum</option>
              <option value="gap_formula">Gap formula</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Early-bird price" name="priceEarly" type="number" />
          <Field
            label="Normal price"
            name="priceNormal"
            type="number"
            required
            defaultValue={event?.default_price != null ? String(event.default_price) : "500"}
          />
          <Field label="Late price" name="priceLate" type="number" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Early-bird ends" name="earlyBirdEnds" type="date" />
          <Field label="Late pricing starts" name="lateStarts" type="date" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Lane count" name="laneCount" type="number" />
          <Field label="Heat duration (min)" name="heatDurationMinutes" type="number" />
          <Field label="Transition (min)" name="transitionMinutes" type="number" />
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Create division
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
      />
    </div>
  );
}
