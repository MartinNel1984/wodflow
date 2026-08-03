import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import TicketsContent from "./TicketsContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const supabase = createPublicClient();
  const { data: event } = await supabase.from("events").select("name").eq("id", eventId).single();
  if (!event?.name) return {};

  return {
    title: `Tickets — ${event.name}`,
    description: `Buy a spectator pass for ${event.name} on Wodflow.`,
  };
}

export default async function TicketsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = createPublicClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, status, spectator_price, weekend_pass_price")
    .eq("id", eventId)
    .single();

  // 404 cleanly when no ticket type is configured — matches the
  // "opt-in per event" design decision (blank price = disabled, no
  // forced default) and the event page only links here when at least
  // one price is set.
  if (!event || !["published", "live"].includes(event.status)) notFound();
  if (event.spectator_price == null && event.weekend_pass_price == null) notFound();

  return <TicketsContent />;
}
