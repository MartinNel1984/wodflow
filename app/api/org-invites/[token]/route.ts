import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// Unauthenticated preview for the invite-org accept page — email/role/box
// name only, no PII beyond what the platform admin already put in the
// invite themselves.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: invite, error } = await supabase
    .from("org_invites")
    .select("status, email, role, organizations(name)")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const org = Array.isArray(invite.organizations) ? invite.organizations[0] : invite.organizations;

  return NextResponse.json({
    status: invite.status,
    email: invite.email,
    role: invite.role,
    organizationName: org?.name ?? null,
  });
}
