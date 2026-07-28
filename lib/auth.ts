import { createClient } from "@/lib/supabase/server";

// Shared authorization guards for server actions. Centralized so the
// "is this caller allowed?" check has exactly one definition — a
// per-file copy silently diverging (e.g. one that forgot to enforce a
// role) would be a security bug, not just a style one. Each returns the
// session-scoped Supabase client so callers can reuse it.

// Every organizer/judge/head_judge profile belongs to one organization
// (see docs/plans/2026-07-28-multi-tenancy-design.md). Guards below fetch
// organization_id + the org's status alongside role so callers that need
// to stamp organization_id on an insert (events, brand_kits, series —
// the only tables that carry the column directly, everything else
// inherits scoping through event_id) don't need a second query, and so
// a suspended org gets a clean error here instead of a silent RLS-denied
// write.

export async function requireOrganizer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, organizations(status)")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "organizer") throw new Error("Not authorised");
  if ((profile.organizations as unknown as { status: string } | null)?.status !== "active") {
    throw new Error("Your organization's access is currently suspended");
  }
  return { supabase, organizationId: profile.organization_id as string };
}

// Organizer OR head judge — matches the scores_privileged_all RLS policy.
// Used where the head judge (Tjokkie's "guardian" role) needs the same
// access an organizer has, e.g. locking heats / correcting scores.
export async function requirePrivileged() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, organizations(status)")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "organizer" && profile?.role !== "head_judge") {
    throw new Error("Not authorised");
  }
  if ((profile.organizations as unknown as { status: string } | null)?.status !== "active") {
    throw new Error("Your organization's access is currently suspended");
  }
  return { supabase, organizationId: profile.organization_id as string };
}

// Platform admin — Martin only. Not organization-scoped.
export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "platform_admin") throw new Error("Not authorised");
  return supabase;
}
