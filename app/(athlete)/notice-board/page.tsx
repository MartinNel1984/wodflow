import { createClient } from "@/lib/supabase/server";
import { AthleteHeroLogo } from "@/components/AthleteHeroLogo";

export default async function NoticeBoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS (migration-056) already limits this to notices for events the
  // athlete is actually registered in — no extra filtering needed here.
  const { data: notices } = await supabase
    .from("notices")
    .select("id, title, body, created_at, events(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-paper">Notice Board</h1>

      <div className="space-y-3">
        {(notices ?? []).map((n) => {
          const event = Array.isArray(n.events) ? n.events[0] : n.events;
          return (
            <div key={n.id} className="bg-white text-ink border-2 border-ink rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{n.title}</p>
                <p className="text-ink/40 text-xs shrink-0">
                  {new Date(n.created_at).toLocaleDateString()}
                </p>
              </div>
              {event?.name && <p className="text-ink/50 text-xs mt-0.5">{event.name}</p>}
              <p className="text-ink/70 text-sm mt-2 whitespace-pre-wrap">{n.body}</p>
            </div>
          );
        })}
        {(notices ?? []).length === 0 && (
          <p className="text-paper/60 text-sm text-center py-10">Nothing posted yet — check back closer to your event.</p>
        )}
      </div>

      <AthleteHeroLogo />
    </div>
  );
}
