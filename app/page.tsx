import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";

export default async function Home() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date, end_date, venue_name")
    .in("status", ["published", "live"])
    .order("start_date", { ascending: true });

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      <div className="text-center max-w-sm mb-10">
        <h1 className="text-3xl font-semibold"><Logo /></h1>
        <p className="mt-2 text-ink/60 text-sm">Competition management for CrossFit events.</p>
      </div>

      <div className="w-full max-w-sm space-y-3 mb-10">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/60">
          Upcoming events
        </h2>
        {(events ?? []).length === 0 && (
          <p className="text-ink/60 text-sm">No events open for registration right now.</p>
        )}
        {(events ?? []).map((e) => (
          <a
            key={e.id}
            href={`/register/${e.id}`}
            className="block bg-white border border-ink/10 rounded-xl px-4 py-3 hover-lift"
          >
            <p className="font-semibold">{e.name}</p>
            <p className="text-ink/60 text-sm">
              {e.start_date}
              {e.end_date ? ` – ${e.end_date}` : ""}
              {e.venue_name ? ` · ${e.venue_name}` : ""}
            </p>
          </a>
        ))}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-2">
        <a
          href="/judge-login"
          className="bg-white border border-ink/10 rounded-lg py-3 text-sm font-semibold hover-lift text-center"
        >
          Judge sign-in
        </a>
        <a
          href="/login"
          className="bg-white border border-ink/10 rounded-lg py-3 text-sm font-semibold hover-lift text-center"
        >
          Organizer sign-in
        </a>
      </div>
    </main>
  );
}
