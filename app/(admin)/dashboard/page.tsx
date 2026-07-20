import { createClient } from "@/lib/supabase/server";
import { computeAllChecks } from "@/lib/checklist";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, name, status, start_date, venue_name, venue_address, contact_email, contact_phone, waiver_text"
    )
    .order("start_date", { ascending: true });

  const rows = await Promise.all(
    (events ?? []).map(async (event) => {
      const [{ data: divisions }, { data: registrations }] = await Promise.all([
        supabase
          .from("divisions")
          .select("id, name, lane_count, heat_duration_minutes, price_normal")
          .eq("event_id", event.id),
        supabase.from("registrations").select("payment_status, price_paid").eq("event_id", event.id),
      ]);

      const checks = computeAllChecks(event, divisions ?? []);
      const failCount = checks.filter((c) => !c.ok).length;

      const regs = registrations ?? [];
      const paid = regs.filter((r) => r.payment_status === "paid");
      const pending = regs.filter((r) => r.payment_status === "pending");
      const revenue = paid.reduce((sum, r) => sum + (r.price_paid ?? 0), 0);

      return {
        event,
        checksTotal: checks.length,
        checksFailed: failCount,
        paidCount: paid.length,
        pendingCount: pending.length,
        revenue,
      };
    })
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-ink/60 text-sm mt-1">Event health at a glance.</p>
      </div>

      <div className="space-y-3">
        {rows.map(({ event, checksTotal, checksFailed, paidCount, pendingCount, revenue }) => (
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
          </div>
        ))}
        {rows.length === 0 && <p className="text-ink/60 text-sm">No events yet.</p>}
      </div>
    </div>
  );
}
