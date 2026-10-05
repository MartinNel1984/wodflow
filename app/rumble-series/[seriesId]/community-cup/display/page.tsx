import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { computeCommunityCupForSeries } from "@/lib/communityCup";
import DisplayView from "./DisplayView";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}): Promise<Metadata> {
  const { seriesId } = await params;
  const supabase = createPublicClient();
  const { data: series } = await supabase
    .from("series")
    .select("name, year, community_cup_enabled")
    .eq("id", seriesId)
    .single();
  if (!series || !series.community_cup_enabled) return {};
  return { title: `${series.name} ${series.year} — Community Cup Display` };
}

export default async function CommunityCupDisplayPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const supabase = createPublicClient();

  const { data: series } = await supabase.from("series").select("id, name, year").eq("id", seriesId).single();
  if (!series) notFound();

  const result = await computeCommunityCupForSeries(supabase, seriesId);
  if (!result.enabled) notFound();

  const eligible = result.gyms
    .filter((g) => g.eligible)
    .map((g) => ({
      gymName: g.gymName,
      totalPoints: g.totalPoints,
      distinctAthleteCount: g.distinctAthleteCount,
    }));

  return (
    <DisplayView
      seriesName={series.name}
      seriesYear={series.year}
      gyms={eligible}
      minAthletes={result.minAthletes}
    />
  );
}
