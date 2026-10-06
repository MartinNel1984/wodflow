import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import type { ScoringConfig } from "@/lib/leaderboard";
import { computeSeriesStandingsForEvents } from "@/lib/seriesStandings";
import EventTable from "./EventTable";

const TOP_N = 50;

export async function renderGenderTable(seriesId: string, gender: "male" | "female") {
  const supabase = createPublicClient();
  const { data: series } = await supabase
    .from("series")
    .select("id, name, year, points_config, series_events(event_id)")
    .eq("id", seriesId)
    .single();
  if (!series) notFound();

  const eventIds = (series.series_events ?? []).map((se) => se.event_id);
  const pointsConfig = (series.points_config ?? { method: "gap_formula", winner_points: 100 }) as ScoringConfig;
  const standings = (await computeSeriesStandingsForEvents(supabase, eventIds, pointsConfig, series.year))
    .filter((s) => s.gender === gender)
    .slice(0, TOP_N);

  // Same name upgrade as the main public leaderboard (profiles are auth-RLS).
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const profileIds = standings.map((s) => s.profileId).filter((id) => uuidPattern.test(id));
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

  return (
    <EventTable
      seriesName={series.name}
      seriesYear={series.year}
      title={`Rumble Series ${gender === "male" ? "Male" : "Female"}`}
      nameHeading="Athlete"
      emptyText="No scored results yet."
      rows={standings.map((s) => ({
        key: s.profileId,
        name: nameByProfile.get(s.profileId) ?? s.displayName,
        pointsByEvent: s.pointsByEvent,
        total: s.totalPoints,
      }))}
    />
  );
}

export async function seriesMetadata(seriesId: string, suffix: string) {
  const supabase = createPublicClient();
  const { data: series } = await supabase.from("series").select("name, year").eq("id", seriesId).single();
  if (!series) return {};
  return { title: `${series.name} ${series.year} — ${suffix}` };
}
