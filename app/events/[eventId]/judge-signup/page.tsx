import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import JudgeSignupForm from "./JudgeSignupForm";

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
    title: `Judge signup — ${event.name}`,
    description: `Put your hand up to judge ${event.name} on Wodflow.`,
  };
}

export default async function JudgeSignupPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = createPublicClient();
  const { data: event } = await supabase.from("events").select("id, status").eq("id", eventId).single();

  if (!event || !["published", "live"].includes(event.status)) notFound();

  return <JudgeSignupForm />;
}
