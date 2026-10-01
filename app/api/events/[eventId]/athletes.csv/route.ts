import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function csvEscape(value: string) {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// Signup collects a single "Full name" field, so split on the last whitespace:
// everything before is first name(s), the final token is the surname. Single-
// token entries fall back to Name only, Surname blank.
function splitName(full: string): { name: string; surname: string } {
  const trimmed = full.trim().replace(/\s+/g, " ");
  if (!trimmed) return { name: "", surname: "" };
  const idx = trimmed.lastIndexOf(" ");
  if (idx === -1) return { name: trimmed, surname: "" };
  return { name: trimmed.slice(0, idx), surname: trimmed.slice(idx + 1) };
}

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  let organizationId: string;
  try {
    ({ organizationId } = await requireOrganizer());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Not authorised." }, { status: 403 });
  }
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("name, organization_id")
    .eq("id", eventId)
    .single();
  if (!event || event.organization_id !== organizationId) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const { data: registrations } = await supabase
    .from("registrations")
    .select("team_name, created_at, divisions(name), registration_athletes(full_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  const header = ["Name", "Surname", "Team Name", "Division", "Registered At"];
  const lines = [header.join(",")];

  for (const r of registrations ?? []) {
    const division = Array.isArray(r.divisions) ? r.divisions[0] : r.divisions;
    for (const a of r.registration_athletes ?? []) {
      const { name, surname } = splitName(a.full_name ?? "");
      lines.push(
        [name, surname, r.team_name ?? "", division?.name ?? "", r.created_at ?? ""]
          .map(csvEscape)
          .join(",")
      );
    }
  }

  const filename = `${(event?.name ?? "event").replace(/[^a-z0-9]+/gi, "-")}-athletes.csv`;

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
