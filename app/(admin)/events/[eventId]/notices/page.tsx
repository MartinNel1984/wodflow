import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { removeNotice } from "./actions";
import NoticeForm from "./NoticeForm";

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
          Shows up in the Notice Board tab for every athlete registered for{" "}
          <span className="font-semibold text-ink">{event?.name ?? "this event"}</span> — briefing
          time changes, updates, anything they need to see.
        </p>
      </div>

      <NoticeForm eventId={eventId} />

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
