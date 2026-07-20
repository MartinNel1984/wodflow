import { createClient } from "@/lib/supabase/server";
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

// Organizer-only — auth enforced here, not just RLS, since the response
// is a raw CSV rather than a page a route guard could redirect away
// from.
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "organizer") return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { data: event } = await supabase.from("events").select("name").eq("id", eventId).single();

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
