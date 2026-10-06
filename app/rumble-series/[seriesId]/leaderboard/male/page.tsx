import type { Metadata } from "next";
import { renderGenderTable, seriesMetadata } from "../../_components/genderPage";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ seriesId: string }> }): Promise<Metadata> {
  const { seriesId } = await params;
  return seriesMetadata(seriesId, "Rumble Series Male");
}

export default async function Page({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  return renderGenderTable(seriesId, "male");
}
