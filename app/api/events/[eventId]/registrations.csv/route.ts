import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function csvEscape(value: string) {
  let v = value;
  // Neutralize spreadsheet formula injection: a cell starting with = + - @
  // (or tab/CR) can be executed as a formula when the organizer opens the
  // CSV in Excel/Sheets, and athlete-supplied fields (name, email) are
  // untrusted. Prefixing a single quote forces it to be treated as text.
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// Organizer-only, scoped to the caller's OWN organization — auth
// enforced here, not just RLS, since the response is a raw CSV rather
// than a page a route guard could redirect away from. Previously only
// checked "is this user an organizer" with no org-ownership check on
// eventId; RLS on registrations/registration_athletes happened to save
// it in practice (they're org-scoped since the multi-tenancy migration),
// but requireOrganizer() here makes that guarantee explicit instead of
// silently depending on RLS shape never changing under this route.
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
    .select(
      "team_name, payment_status, price_paid, divisions(name), registration_athletes(full_name, email, id_number, is_minor, waiver_signed_at)"
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  const header = [
    "Division",
    "Team",
    "Athlete",
    "Email",
    "ID Number",
    "Minor",
    "Waiver Signed",
    "Payment Status",
    "Price Paid",
  ];
  const lines = [header.join(",")];

  for (const r of registrations ?? []) {
    const division = Array.isArray(r.divisions) ? r.divisions[0] : r.divisions;
    for (const a of r.registration_athletes ?? []) {
      lines.push(
        [
          division?.name ?? "",
          r.team_name ?? "",
          a.full_name ?? "",
          a.email ?? "",
          a.id_number ?? "",
          a.is_minor ? "Yes" : "No",
          a.waiver_signed_at ? "Yes" : "No",
          r.payment_status ?? "",
          String(r.price_paid ?? ""),
        ]
          .map(csvEscape)
          .join(",")
      );
    }
  }

  const filename = `${(event?.name ?? "event").replace(/[^a-z0-9]+/gi, "-")}-registrations.csv`;

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
