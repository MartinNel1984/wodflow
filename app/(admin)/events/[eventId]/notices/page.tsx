import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { addNotice, removeNotice } from "./actions";

export default async function NoticesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: notices }] = await Promise.all([
    supabase.from("events").select("name").eq("id", eventId).single(),
    supabase
      .from("notices")
      .select("id, title, body, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <Link href={`/events/${eventId}/checklist`} className="text-accent text-sm hover:underline">
          ← {event?.name ?? "Event"}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Notice board</h1>
        <p className="text-ink/60 text-sm mt-1">
          Shows up in the Notice Board tab for every athlete registered for this event — briefing
          time changes, updates, anything they need to see.
        </p>
      </div>

      <form action={addNotice} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <h2 className="font-semibold">Post a notice</h2>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Title</label>
          <input
            type="text"
            name="title"
            required
            placeholder="Briefing time change"
            className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Message</label>
          <textarea
            name="body"
            rows={4}
            required
            className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Post notice
        </button>
      </form>

      <div className="space-y-3">
        {(notices ?? []).map((n) => (
          <div key={n.id} className="bg-white border border-ink/10 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{n.title}</p>
                <p className="text-ink/70 text-sm mt-1 whitespace-pre-wrap">{n.body}</p>
                <p className="text-ink/40 text-xs mt-2">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <form action={removeNotice}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className="text-xs text-ink/40 hover:text-ink/70 shrink-0">
                  Remove
                </button>
              </form>
            </div>
          </div>
        ))}
        {(notices ?? []).length === 0 && (
          <p className="text-ink/60 text-sm text-center py-6">No notices posted yet.</p>
        )}
      </div>
    </div>
  );
}
