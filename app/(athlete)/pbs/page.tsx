import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PB_LIFTS } from "@/lib/pbLifts";
import PBCard from "./PBCard";
import { AthleteHeroLogo } from "@/components/AthleteHeroLogo";

type PbRanking = {
  lift_key: string;
  my_best_value: number;
  my_best_date: string;
  athlete_rank: number;
  total_athletes: number;
};

export default async function PbsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Server-side gate matches public.is_atg_athlete() (migration-070) —
  // the nav tab is already hidden for non-ATG athletes, this is the
  // defense-in-depth check for anyone hitting the URL directly.
  const { data: profile } = await supabase.from("profiles").select("gym_name").eq("id", user.id).single();
  const gymName = (profile?.gym_name ?? "").toLowerCase();
  const isAtgAthlete = gymName.includes("atg") || gymName.includes("against the grain");
  if (!isAtgAthlete) redirect("/portal");

  const [{ data: allPbs }, { data: rankings }] = await Promise.all([
    supabase
      .from("athlete_pbs")
      .select("id, lift_key, value_numeric, achieved_date, created_at")
      .eq("profile_id", user.id)
      .order("achieved_date", { ascending: false }),
    supabase.rpc("get_my_pb_rankings") as unknown as Promise<{ data: PbRanking[] | null }>,
  ]);

  const pbsByLift = new Map<string, NonNullable<typeof allPbs>>();
  for (const row of allPbs ?? []) {
    const list = pbsByLift.get(row.lift_key) ?? [];
    list.push(row);
    pbsByLift.set(row.lift_key, list);
  }

  const rankByLift = new Map((rankings ?? []).map((r: PbRanking) => [r.lift_key, r]));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold">Personal Bests</h1>
        <p className="text-paper/60 text-sm">Log your 1RMs and benchmark times, see where you rank at ATG.</p>
      </div>

      <div className="space-y-4">
        {PB_LIFTS.map((lift) => (
          <PBCard
            key={lift.key}
            lift={lift}
            profileId={user.id}
            entries={(pbsByLift.get(lift.key) ?? []).slice(0, 4)}
            ranking={rankByLift.get(lift.key) ?? null}
          />
        ))}
      </div>

      <AthleteHeroLogo size="lg" />
    </div>
  );
}
