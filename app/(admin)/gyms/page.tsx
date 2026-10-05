import { requireOrganizer } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import GymsTable, { type GymRow } from "./GymsTable";

export default async function GymsPage() {
  await requireOrganizer();
  const svc = createServiceClient();

  const [{ data: gyms }, { data: profileCounts }, { data: raCounts }] = await Promise.all([
    svc.from("gyms").select("id, name, approved, created_at").order("approved", { ascending: true }).order("name"),
    svc.from("profiles").select("gym_name").not("gym_name", "is", null),
    svc.from("registration_athletes").select("gym_name").not("gym_name", "is", null),
  ]);

  // Combine profile + registration_athletes counts per gym name so the
  // organiser can see which pending gyms are in heavy use (the signal
  // for "rename this to the canonical spelling and merge").
  const counts = new Map<string, number>();
  for (const row of profileCounts ?? []) {
    const n = (row.gym_name as string | null)?.trim();
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  for (const row of raCounts ?? []) {
    const n = (row.gym_name as string | null)?.trim();
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }

  const rows: GymRow[] = (gyms ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    approved: g.approved,
    createdAt: g.created_at,
    athleteCount: counts.get(g.name) ?? 0,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Gyms</h1>
        <p className="text-ink/60 text-sm mt-1">
          Master list for the signup dropdown. Approve pending suggestions, rename them to the canonical
          spelling (e.g. &ldquo;ATG Bryanston&rdquo; → &ldquo;ATG CrossFit Bryanston&rdquo;) — renames
          cascade to every athlete record pointing at the old name.
        </p>
      </div>
      <GymsTable rows={rows} />
    </div>
  );
}
