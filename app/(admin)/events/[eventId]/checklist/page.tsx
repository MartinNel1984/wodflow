import { createClient } from "@/lib/supabase/server";
import { computeEventChecks, computeDivisionChecks, type CheckItem } from "@/lib/checklist";
import { updateWaiverText, updateJudgingMode, updatePaymentProvider } from "./actions";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: divisions }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "name, venue_name, venue_address, contact_email, contact_phone, waiver_text, status, judging_mode, payment_provider"
      )
      .eq("id", eventId)
      .single(),
    supabase
      .from("divisions")
      .select("id, name, lane_count, heat_duration_minutes, price_normal")
      .eq("event_id", eventId),
  ]);

  const eventChecks = computeEventChecks(event, divisions ?? []);
  const divisionChecks = computeDivisionChecks(divisions ?? []);
  const allChecks = [...eventChecks, ...divisionChecks];
  const failCount = allChecks.filter((c) => !c.ok).length;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <a href="/events" className="text-accent text-sm hover:underline">
          ← Events
        </a>
        <h1 className="text-2xl font-semibold mt-1">{event?.name ?? "Event"} — Pre-event checklist</h1>
        <p className="text-ink/60 text-sm mt-1">
          Run this the day before — this is exactly what was missing on the ScoreIT event that
          broke: an event days away with no address, contact, or config filled in.
        </p>
      </div>

      <div
        className={`rounded-xl p-4 font-semibold text-sm ${
          failCount === 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {failCount === 0 ? "All checks passed — ready to go." : `${failCount} item(s) need attention.`}
      </div>

      <div className="bg-white border border-ink/10 rounded-xl p-4 space-y-2">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">Event</h2>
        {eventChecks.map((c) => (
          <CheckRow key={c.label} item={c} />
        ))}
      </div>

      <div className="bg-white border border-ink/10 rounded-xl p-4 flex items-center gap-4">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50 shrink-0">Reports</h2>
        <a href={`/api/events/${eventId}/registrations.csv`} className="text-accent text-sm hover:underline">
          Export registrations CSV
        </a>
        <a href={`/events/${eventId}/reports/waivers`} className="text-accent text-sm hover:underline">
          All signed waivers
        </a>
      </div>

      <div className="bg-white border border-ink/10 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">Settings</h2>
        <form action={updateJudgingMode} className="flex items-center justify-between gap-3">
          <input type="hidden" name="eventId" value={eventId} />
          <div>
            <p className="text-sm font-semibold">Scoring model</p>
            <p className="text-ink/60 text-xs">
              Centralized: only the head judge enters scores. Distributed: each judge scores their
              own assigned heats.
            </p>
          </div>
          <select
            name="judgingMode"
            defaultValue={event?.judging_mode ?? "centralized"}
            className="text-sm border border-ink/10 rounded-lg px-2 py-1.5"
          >
            <option value="centralized">Centralized</option>
            <option value="distributed">Distributed</option>
          </select>
          <button type="submit" className="text-sm text-accent font-semibold shrink-0">
            Save
          </button>
        </form>
        <form action={updatePaymentProvider} className="flex items-center justify-between gap-3">
          <input type="hidden" name="eventId" value={eventId} />
          <div>
            <p className="text-sm font-semibold">Payment provider</p>
            <p className="text-ink/60 text-xs">Which checkout athletes are sent to when they register and pay.</p>
          </div>
          <select
            name="paymentProvider"
            defaultValue={event?.payment_provider ?? "yoco"}
            className="text-sm border border-ink/10 rounded-lg px-2 py-1.5"
          >
            <option value="yoco">Yoco</option>
            <option value="payfast">PayFast</option>
          </select>
          <button type="submit" className="text-sm text-accent font-semibold shrink-0">
            Save
          </button>
        </form>
      </div>

      <form action={updateWaiverText} className="bg-white border border-ink/10 rounded-xl p-4 space-y-3">
        <input type="hidden" name="eventId" value={eventId} />
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">
          Waiver / indemnity text
        </h2>
        <p className="text-ink/60 text-xs">
          Shown to every athlete at registration, and snapshotted onto their record when they sign —
          editing this later doesn&apos;t change what past registrants agreed to.
        </p>
        <textarea
          name="waiverText"
          rows={10}
          defaultValue={event?.waiver_text ?? ""}
          className="w-full bg-paper rounded-lg px-4 py-3 text-xs border border-ink/10 focus:outline-none focus:border-accent whitespace-pre-wrap"
        />
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Save waiver text
        </button>
      </form>

      {(divisions ?? []).map((d) => (
        <div key={d.id} className="bg-white border border-ink/10 rounded-xl p-4 space-y-2">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">{d.name}</h2>
          {divisionChecks
            .filter((c) => c.divisionName === d.name)
            .map((c) => (
              <CheckRow key={`${d.id}-${c.label}`} item={c} />
            ))}
        </div>
      ))}
    </div>
  );
}

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{item.label}</span>
      <span className={item.ok ? "text-green-700" : "text-amber-700 font-semibold"}>
        {item.ok ? "✓" : "Missing"}
      </span>
    </div>
  );
}
