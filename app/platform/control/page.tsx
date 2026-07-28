import { createClient } from "@/lib/supabase/server";
import { createOrganization, setOrganizationStatus, createOrgInvite } from "./actions";
import { Logo } from "@/components/Logo";

const SITE_URL = "https://wodflow.co.za";

export default async function PlatformControlPage() {
  const supabase = await createClient();

  const [{ data: orgs }, { data: profiles }, { data: events }, { data: invites }] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, status, created_at").order("created_at"),
    supabase.from("profiles").select("id, role, organization_id"),
    supabase.from("events").select("id, status, organization_id"),
    supabase
      .from("org_invites")
      .select("id, organization_id, email, role, token, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const orgList = orgs ?? [];
  const totalAthletes = (profiles ?? []).filter((p) => p.role === "athlete").length;
  const totalEvents = (events ?? []).length;
  const activeOrgs = orgList.filter((o) => o.status === "active").length;
  const suspendedOrgs = orgList.filter((o) => o.status === "suspended").length;

  const orgRows = orgList.map((org) => ({
    ...org,
    organizerCount: (profiles ?? []).filter(
      (p) => p.organization_id === org.id && (p.role === "organizer" || p.role === "head_judge" || p.role === "judge"),
    ).length,
    eventCount: (events ?? []).filter((e) => e.organization_id === org.id).length,
    pendingInvites: (invites ?? []).filter((i) => i.organization_id === org.id),
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">
          <Logo />
        </h1>
        <p className="text-script text-lg mt-1 text-accent">Every box, one wall.</p>
        <p className="text-paper/60 text-sm mt-1">Platform control — not linked anywhere, bookmark it.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Boxes" value={orgList.length} sub={`${activeOrgs} active · ${suspendedOrgs} suspended`} />
        <Stat label="Athletes" value={totalAthletes} />
        <Stat label="Events" value={totalEvents} />
        <Stat label="Pending invites" value={(invites ?? []).length} />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Boxes</h2>
        <div className="space-y-3">
          {orgRows.map((org) => (
            <div key={org.id} className="bg-white text-ink border-2 border-ink rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold">
                    {org.name}{" "}
                    <span
                      className={`ml-2 text-xs uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        org.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {org.status}
                    </span>
                  </div>
                  <div className="text-ink/50 text-xs mt-1">
                    /{org.slug} · {org.organizerCount} team member{org.organizerCount === 1 ? "" : "s"} ·{" "}
                    {org.eventCount} event{org.eventCount === 1 ? "" : "s"}
                  </div>
                </div>
                <form action={setOrganizationStatus}>
                  <input type="hidden" name="id" value={org.id} />
                  <input type="hidden" name="status" value={org.status === "active" ? "suspended" : "active"} />
                  <button
                    type="submit"
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border-2 ${
                      org.status === "active"
                        ? "border-red-700 text-red-700 hover:bg-red-50"
                        : "border-emerald-700 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {org.status === "active" ? "Suspend" : "Reactivate"}
                  </button>
                </form>
              </div>

              {org.pendingInvites.length > 0 && (
                <div className="text-xs text-ink/60 space-y-1 border-t border-ink/10 pt-3">
                  {org.pendingInvites.map((inv) => (
                    <div key={inv.id}>
                      Pending {inv.role} invite for {inv.email}:{" "}
                      <span className="text-ink break-all">{`${SITE_URL}/invite-org/${inv.token}`}</span>
                    </div>
                  ))}
                </div>
              )}

              <form action={createOrgInvite} className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
                <input type="hidden" name="organizationId" value={org.id} />
                <input
                  type="email"
                  name="email"
                  placeholder="new organizer's email"
                  required
                  className="bg-paper border border-ink/15 rounded-lg px-2 py-1 text-sm flex-1 min-w-[180px]"
                />
                <select name="role" defaultValue="organizer" className="bg-paper border border-ink/15 rounded-lg px-2 py-1 text-sm">
                  <option value="organizer">organizer</option>
                  <option value="head_judge">head judge</option>
                  <option value="judge">judge</option>
                </select>
                <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white hover:opacity-90">
                  Generate invite link
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Add a new box</h2>
        <form action={createOrganization} className="bg-white text-ink border-2 border-ink rounded-xl p-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="name"
            placeholder="Box name, e.g. Against The Grain Fitness"
            required
            className="bg-paper border border-ink/15 rounded-lg px-3 py-2 text-sm flex-1 min-w-[240px]"
          />
          <button type="submit" className="text-sm font-semibold px-4 py-2 rounded-lg bg-accent text-white hover:opacity-90">
            Create organization
          </button>
        </form>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white text-ink border-2 border-ink rounded-2xl px-2 py-4 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-ink/60 text-xs mt-1">{label}</div>
      {sub && <div className="text-ink/40 text-[11px] mt-1">{sub}</div>}
    </div>
  );
}
