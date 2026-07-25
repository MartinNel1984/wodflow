import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import RegisterContent from "./RegisterContent";

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
    title: `Register — ${event.name}`,
    description: `Register your team for ${event.name} on Wodflow.`,
  };
}

export default function RegisterPage() {
  return <RegisterContent />;
}
