import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// Public list of judges (and head judges) for the PIN login screen.
// Returns ONLY safe display fields (name, role) — never emails or PIN
// hashes. Only profiles that have a PIN set are shown.
//
// SCOPED TO ONE ORGANIZATION. This previously returned every judge on
// the platform to any anonymous caller, which (a) disclosed the full
// names of other organizations' staff and (b) would put another org's
// judges in this org's login picker as soon as a second tenant existed.
//
// Resolution order:
//   1. ?org=<slug> — explicit, always correct.
//   2. If the platform has exactly ONE active organization, use it.
//      This keeps the current single-tenant deployment working with no
//      link changes, and stops being a shortcut the moment a second org
//      is onboarded — at which point the param becomes required and the
//      UI asks which organization the judge belongs to. It deliberately
//      never falls back to "all judges", which is the leak being closed.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("org")?.trim() || null;
  const supabase = createServiceClient();

  let organizationId: string | null = null;

  if (slug) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!org) {
      return NextResponse.json({ error: "Unknown organization." }, { status: 404 });
    }
    organizationId = org.id as string;
  } else {
    const { data: orgs, error: orgErr } = await supabase
      .from("organizations")
      .select("id, slug, name")
      .eq("status", "active")
      .limit(2);
    if (orgErr) {
      return NextResponse.json({ error: orgErr.message }, { status: 500 });
    }
    if ((orgs ?? []).length === 1) {
      organizationId = orgs![0].id as string;
    } else {
      return NextResponse.json({ judges: [], needsOrg: true });
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("organization_id", organizationId)
    .in("role", ["judge", "head_judge"])
    .eq("pin_set", true)
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ judges: data ?? [] });
}
