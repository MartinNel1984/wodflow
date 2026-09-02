import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { computeStandings, type LeaderboardRow, type ScoringConfig } from "@/lib/leaderboard";
import { isPrivilegedFor } from "@/lib/auth";
import type { BrandKit } from "@/lib/brandKit";
import LeaderboardView from "./view";

export const revalidate = 8;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ divisionId: string }>;
}): Promise<Metadata> {
  const { divisionId } = await params;
  const supabase = createPublicClient();
  const { data: division } = await supabase
    .from("divisions")
    .select("name, events(name)")
    .eq("id", divisionId)
    .single();
  if (!division) return {};

  const event = Array.isArray(division.events) ? division.events[0] : division.events;
  const title = event?.name ? `${division.name} — ${event.name} Leaderboard` : `${division.name} Leaderboard`;
  return {
    title,
    description: `Live leaderboard for ${division.name}${event?.name ? ` at ${event.name}` : ""} on Wodflow.`,
  };
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ divisionId: string }>;
}) {
  const { divisionId } = await params;
  const supabase = createPublicClient();

  // Division + brand kit fetched up front (not just after the gate) so the
  // "not available yet" message can still render inside the event's Rumble
  // branding instead of falling back to a plain unbranded page (Tjokkie,
  // 2026-09-02).
  const { data: division } = await supabase
    .from("divisions")
    .select(
      "name, workout_scoring_type, scoring_config, events(organization_id, results_visible, start_date, end_date, brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline))"
    )
    .eq("id", divisionId)
    .single();
  const event = Array.isArray(division?.events) ? division.events[0] : division?.events;
  const isPreview = event?.results_visible === false && (await isPrivilegedFor(event.organization_id));
  const isHidden = event?.results_visible === false && !isPreview;
  const brandKit = (Array.isArray(event?.brand_kits) ? event.brand_kits[0] : event?.brand_kits) as
    | BrandKit
    | null
    | undefined;

  if (isHidden) {
    return (
      <LeaderboardView
        divisionName={division?.name ?? "Leaderboard"}
        standings={[]}
        workouts={[]}
        brandKit={brandKit ?? null}
        hiddenMessage="Leaderboard isn't available yet — check back on event day."
      />
    );
  }

  const { data: rows } = await supabase
    .from("public_leaderboard")
    .select(
      "heat_assignment_id, workout_id, value_raw, registration_id, display_name, tiebreak_value, workout_name, workout_scoring_config, rx_or_scaled"
    )
    .eq("division_id", divisionId);

  const scoringConfig = (division?.scoring_config ?? { method: "rank_sum" }) as ScoringConfig;
  const { standings, workouts } = computeStandings((rows ?? []) as LeaderboardRow[], scoringConfig);

  // Team rosters for the "tap a team name" expand — only fetched for the
  // registrations actually on this leaderboard, so a solo division pays
  // no extra query cost.
  const registrationIds = [...new Set((rows ?? []).map((r) => r.registration_id))];
  const teamMembers: Record<string, string[]> = {};
  if (registrationIds.length > 0) {
    const { data: athletes } = await supabase
      .from("public_team_rosters")
      .select("registration_id, full_name, is_captain")
      .in("registration_id", registrationIds)
      .order("is_captain", { ascending: false });
    for (const a of athletes ?? []) {
      (teamMembers[a.registration_id] ??= []).push(a.full_name);
    }
  }

  return (
    <LeaderboardView
      divisionName={division?.name ?? "Leaderboard"}
      standings={standings}
      workouts={workouts}
      brandKit={brandKit ?? null}
      teamMembers={teamMembers}
      eventStartDate={event?.start_date ?? null}
      eventEndDate={event?.end_date ?? null}
      isPreview={isPreview}
    />
  );
}
