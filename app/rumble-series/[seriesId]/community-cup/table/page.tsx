import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { computeCommunityCupForSeries } from "@/lib/communityCup";
import EventTable from "../../_components/EventTable";
import { seriesMetadata } from "../../_components/genderPage";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ seriesId: string }> }): Promise<Metadata> {
  const { seriesId } = await params;
  return seriesMetadata(seriesId, "Community Cup");
}

// Like /display, this deliberately skips the community_cup_enabled gate
// so the table can be screen-recorded before the 2027 public flip.
export default async function Page({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const supabase = createPublicClient();
  const { data: series } = await supabase.from("series").select("id, name, year").eq("id", seriesId).single();
  if (!series) notFound();

  const result = await computeCommunityCupForSeries(supabase, seriesId);
  const gyms = result.gyms.filter((g) => g.eligible);

  return (
    <EventTable
      seriesName={series.name}
      seriesYear={series.year}
      title="Community Cup"
      nameHeading="Gym"
      emptyText="No gyms qualified yet."
      rows={gyms.map((g) => ({
        key: g.gymId ?? g.gymName,
        name: g.gymName,
        sub: `${g.distinctAthleteCount} athletes`,
        pointsByEvent: g.pointsByEvent,
        total: g.totalPoints,
      }))}
    />
  );
}
