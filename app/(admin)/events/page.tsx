import { createClient } from "@/lib/supabase/server";
import { createEvent, updateEventStatus } from "./actions";
import Link from "next/link";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug, start_date, end_date, status")
    .order("start_date", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Events</h1>

      <div className="space-y-3">
        {(events ?? []).map((e) => (
          <div
            key={e.id}
            className="bg-white border border-ink/10 rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <Link href={`/events/${e.id}/divisions`} className="font-semibold hover:underline">
                {e.name}
              </Link>
              <p className="text-ink/60 text-sm">
                {e.start_date}
                {e.end_date ? ` – ${e.end_date}` : ""}
              </p>
              <Link href={`/events/${e.id}/checklist`} className="text-accent text-xs hover:underline">
                Pre-event checklist
              </Link>
            </div>
            <form action={updateEventStatus} className="flex items-center gap-2">
              <input type="hidden" name="id" value={e.id} />
              <select
                name="status"
                defaultValue={e.status}
                className="text-sm border border-ink/10 rounded-lg px-2 py-1"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="live">Live</option>
                <option value="archived">Archived</option>
              </select>
              <button type="submit" className="text-sm text-accent font-semibold">
                Save
              </button>
            </form>
          </div>
        ))}
        {(!events || events.length === 0) && (
          <p className="text-ink/60 text-sm">No events yet — create one below.</p>
        )}
      </div>

      <form action={createEvent} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">New event</h2>
        <Field label="Name" name="name" required />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date" name="startDate" type="date" required />
          <Field label="End date" name="endDate" type="date" />
        </div>
        <Field label="Venue name" name="venueName" />
        <Field label="Venue address" name="venueAddress" />
        <Field label="Default division cost (R)" name="defaultPrice" type="number" defaultValue="500" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact email" name="contactEmail" type="email" />
          <Field label="Contact phone" name="contactPhone" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
            Waiver text
          </label>
          <textarea
            name="waiverText"
            rows={4}
            className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Create event
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
