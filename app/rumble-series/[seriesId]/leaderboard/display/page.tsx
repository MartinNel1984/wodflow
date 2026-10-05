import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import type { ScoringConfig } from "@/lib/leaderboard";
import { computeSeriesStandingsForEvents } from "@/lib/seriesStandings";
import DisplayView from "./DisplayView";

export const revalidate = 60;

const TOP_N_PER_GENDER = 50;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}): Promise<Metadata> {
  const { seriesId } = await params;
  const supabase = createPublicClient();
  const { data: series } = await supabase.from("series").select("name, year").eq("id", seriesId).single();
  if (!series) return {};
  return { title: `${series.name} ${series.year} — Display` };
}

export default async function SeriesDisplayPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const supabase = createPublicClient();

  const { data: series } = await supabase
    .from("series")
    .select("id, name, year, points_config, series_events(event_id)")
    .eq("id", seriesId)
    .single();
  if (!series) notFound();

  const eventIds = (series.series_events ?? []).map((se) => se.event_id);
  const pointsConfig = (series.points_config ?? { method: "gap_formula", winner_points: 100 }) as ScoringConfig;
  const seriesStandings = await computeSeriesStandingsForEvents(supabase, eventIds, pointsConfig, series.year);

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const profileIds = seriesStandings.map((s) => s.profileId).filter((id) => uuidPattern.test(id));
  const nameByProfile = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: rosters } = await supabase
      .from("public_team_rosters")
      .select("profile_id, full_name")
      .in("profile_id", profileIds);
    for (const r of rosters ?? []) {
      if (r.profile_id && r.full_name && !nameByProfile.has(r.profile_id)) {
        nameByProfile.set(r.profile_id, r.full_name);
      }
    }
  }

  const male = seriesStandings
    .filter((s) => s.gender === "male")
    .slice(0, TOP_N_PER_GENDER)
    .map((s) => ({
      name: nameByProfile.get(s.profileId) ?? s.displayName,
      total: s.totalPoints,
    }));
  const female = seriesStandings
    .filter((s) => s.gender === "female")
    .slice(0, TOP_N_PER_GENDER)
    .map((s) => ({
      name: nameByProfile.get(s.profileId) ?? s.displayName,
      total: s.totalPoints,
    }));

  return (
    <DisplayView
      seriesName={series.name}
      seriesYear={series.year}
      male={male}
      female={female}
    />
  );
}
