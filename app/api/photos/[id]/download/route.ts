import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// hub_photos.image_url is always a Supabase storage URL an organizer
// uploaded (never arbitrary user input) — looking it up by id first,
// rather than accepting a URL directly, keeps this from being an open
// fetch proxy.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: photo } = await supabase.from("hub_photos").select("image_url, caption").eq("id", id).single();
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const upstream = await fetch(photo.image_url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Could not fetch photo" }, { status: 502 });
  }

  const ext = photo.image_url.split(".").pop()?.split("?")[0] || "jpg";
  const filename = `${(photo.caption || "rumble-photo").replace(/[^a-z0-9-]+/gi, "-")}.${ext}`;

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
