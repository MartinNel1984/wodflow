import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const PAGE_SIZE = 1000; // PostgREST's own per-request row cap

// Loads one event's photos on demand (called when an athlete taps that
// event's tab in the Photos picker) rather than the page fetching every
// event's photos upfront — with 3,000+ photos across just two events,
// that was both slow and silently truncated by PostgREST's 1000-row
// cap (rows came back as an arbitrary interleaved mix across events
// since hub_photos.sort_order restarts at 0 per event). Paginating
// here, scoped to one event at a time, avoids the cap entirely.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if ((type !== "event" && type !== "historical") || !id) {
    return NextResponse.json({ error: "Invalid type/id" }, { status: 400 });
  }
  const column = type === "event" ? "event_id" : "historical_event_id";

  const supabase = await createClient();
  const photos: { id: string; image_url: string; caption: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("hub_photos")
      .select("id, image_url, caption")
      .eq(column, id)
      .order("sort_order", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    photos.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return NextResponse.json({ photos });
}
