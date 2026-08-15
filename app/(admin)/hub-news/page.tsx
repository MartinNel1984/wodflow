import { requireOrganizer } from "@/lib/auth";
import { addHubNews, deleteHubNews } from "./actions";

export default async function HubNewsPage() {
  const { supabase, organizationId } = await requireOrganizer();
  // hub_news' read policy is deliberately public (backs the public
  // homepage News section), so this admin listing must filter to the
  // caller's own org itself — same cross-org leak fix as hub-photos.
  const { data: news } = await supabase
    .from("hub_news")
    .select("id, title, body, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Hub news</h1>
        <p className="text-ink/60 text-sm mt-1">
          Posts shown in the public homepage&apos;s News section, newest first. For messages to your
          own registered athletes instead, use Notices on the event page.
        </p>
      </div>

      <form action={addHubNews} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Post news</h2>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Title</label>
          <input
            type="text"
            name="title"
            required
            placeholder="Heats are live"
            className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
            Details (optional)
          </label>
          <textarea
            name="body"
            rows={3}
            className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Post
        </button>
      </form>

      <div className="bg-white border border-ink/10 rounded-xl divide-y divide-ink/10">
        {(news ?? []).map((n) => (
          <div key={n.id} className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">{n.title}</p>
              {n.body && <p className="text-ink/60 text-sm mt-1">{n.body}</p>}
              <p className="text-ink/40 text-xs mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
            </div>
            <form action={deleteHubNews}>
              <input type="hidden" name="id" value={n.id} />
              <button type="submit" className="text-xs text-ink/40 hover:text-red-700 shrink-0">
                Delete
              </button>
            </form>
          </div>
        ))}
        {(!news || news.length === 0) && (
          <p className="p-4 text-ink/60 text-sm text-center">No news posted yet.</p>
        )}
      </div>
    </div>
  );
}
