import { createClient } from "@/lib/supabase/server";
import { computeAllChecks } from "@/lib/checklist";
import { requireOrganizer } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { organizationId } = await requireOrganizer();

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, name, status, start_date, venue_name, venue_address, contact_email, contact_phone, waiver_text"
    )
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: true });

  const eventIds = (events ?? []).map((e) => e.id);
  const today = new Date().toISOString().slice(0, 10);

  const [{ count: athleteCount }, { data: paidRegs }] = await Promise.all([
    eventIds.length
      ? supabase
          .from("registration_athletes")
          .select("id, registrations!inner(event_id)", { count: "exact", head: true })
          .in("registrations.event_id", eventIds)
      : Promise.resolve({ count: 0 }),
    eventIds.length
      ? supabase
          .from("registrations")
          .select("price_paid")
          .in("event_id", eventIds)
          .eq("payment_status", "paid")
      : Promise.resolve({ data: [] }),
  ]);

  const totalRevenue = (paidRegs ?? []).reduce((sum, r) => sum + (r.price_paid ?? 0), 0);
  const upcomingEvents = (events ?? []).filter(
    (e) => (e.status === "published" || e.status === "live") && e.start_date >= today
  ).length;

  const rows = await Promise.all(
    (events ?? []).map(async (event) => {
      const [{ data: divisions }, { data: registrations }] = await Promise.all([
        supabase
          .from("divisions")
          .select("id, name, gender, price_normal, max_entries, workouts(id, name, lane_count, heat_duration_minutes)")
          .eq("event_id", event.id),
        supabase
          .from("registrations")
          .select("division_id, payment_status, price_paid")
          .eq("event_id", event.id),
      ]);

      const checks = computeAllChecks(event, divisions ?? []);
      const failCount = checks.filter((c) => !c.ok).length;

      const regs = registrations ?? [];
      const paid = regs.filter((r) => r.payment_status === "paid");
      const pending = regs.filter((r) => r.payment_status === "pending");
      const revenue = paid.reduce((sum, r) => sum + (r.price_paid ?? 0), 0);

      // Same "filled" definition as the DB-level cap enforcement
      // (migration-033): every non-refunded registration counts against
      // the division's max_entries, whether paid or still pending.
      const divisionCounts = (divisions ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        gender: d.gender as string | null,
        maxEntries: d.max_entries as number | null,
        filled: regs.filter((r) => r.division_id === d.id && r.payment_status !== "refunded").length,
      }));

      return {
        event,
        checksTotal: checks.length,
        checksFailed: failCount,
        paidCount: paid.length,
        pendingCount: pending.length,
        revenue,
        divisionCounts,
      };
    })
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-ink/60 text-sm mt-1">Event health at a glance.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total athletes" value={athleteCount ?? 0} />
        <StatCard label="Total revenue" value={`R${totalRevenue.toLocaleString("en-ZA")}`} accent />
        <StatCard label="Upcoming events" value={upcomingEvents} />
      </div>

      <div className="space-y-3">
        {rows.map(({ event, checksTotal, checksFailed, paidCount, pendingCount, revenue, divisionCounts }) => (
          <div key={event.id} className="bg-white border border-ink/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <Link href={`/events/${event.id}/divisions`} className="font-semibold hover:underline">
                  {event.name}
                </Link>
                <p className="text-ink/60 text-sm">{event.start_date}</p>
              </div>
              <span
                className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  event.status === "live"
                    ? "bg-green-100 text-green-700"
                    : event.status === "published"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-ink/10 text-ink/60"
                }`}
              >
                {event.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link
                href={`/events/${event.id}/checklist`}
                className={
                  checksFailed === 0
                    ? "text-green-700 font-semibold hover:underline"
                    : "text-amber-700 font-semibold hover:underline"
                }
              >
                {checksFailed === 0 ? "✓ Checklist ready" : `${checksFailed}/${checksTotal} checklist items missing`}
              </Link>
              <span className="text-ink/50">
                {paidCount} paid{pendingCount > 0 ? ` · ${pendingCount} pending` : ""} · R{revenue} revenue
              </span>
            </div>
            {divisionCounts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-ink/10">
                {divisionCounts.map((d) => {
                  const isFull = d.maxEntries != null && d.filled >= d.maxEntries;
                  return (
                    <span
                      key={d.id}
                      className={`text-xs font-data px-2 py-1 rounded-full ${
                        isFull ? "bg-amber-100 text-amber-700" : "bg-ink/5 text-ink/60"
                      }`}
                    >
                      {d.name}
                      {d.gender ? ` (${d.gender})` : ""}: {d.filled}
                      {d.maxEntries != null ? `/${d.maxEntries}` : ""}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-ink/60 text-sm">No events yet.</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-white border border-ink/10 rounded-xl p-6">
      <p className={`font-display text-4xl ${accent ? "text-accent" : ""}`}>
        <span className="font-data">{value}</span>
      </p>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink/50 mt-1">{label}</p>
    </div>
  );
}
