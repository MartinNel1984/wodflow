import { createClient } from "@/lib/supabase/server";
import { computeStandings, type LeaderboardRow, type ScoringConfig } from "@/lib/leaderboard";
import type { BrandKit } from "@/lib/brandKit";
import LeaderboardView from "./view";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ divisionId: string }>;
}) {
  const { divisionId } = await params;
  const supabase = await createClient();

  const [{ data: division }, { data: rows }] = await Promise.all([
    supabase
      .from("divisions")
      .select(
        "name, workout_scoring_type, scoring_config, events(brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline))"
      )
      .eq("id", divisionId)
      .single(),
    supabase
      .from("public_leaderboard")
      .select("heat_assignment_id, workout_id, value_raw, registration_id, display_name, tiebreak_value")
      .eq("division_id", divisionId),
  ]);

  const scoringConfig = (division?.scoring_config ?? { method: "rank_sum" }) as ScoringConfig;
  const { standings, workouts } = computeStandings((rows ?? []) as LeaderboardRow[], scoringConfig);

  const event = Array.isArray(division?.events) ? division.events[0] : division?.events;
  const brandKit = (Array.isArray(event?.brand_kits) ? event.brand_kits[0] : event?.brand_kits) as
    | BrandKit
    | null
    | undefined;

  return (
    <LeaderboardView
      divisionName={division?.name ?? "Leaderboard"}
      standings={standings}
      workouts={workouts}
      brandKit={brandKit ?? null}
    />
  );
}
