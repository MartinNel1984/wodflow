import { createClient } from "@/lib/supabase/server";

// Shared authorization guards for server actions. Centralized so the
// "is this caller allowed?" check has exactly one definition — a
// per-file copy silently diverging (e.g. one that forgot to enforce a
// role) would be a security bug, not just a style one. Each returns the
// session-scoped Supabase client so callers can reuse it.

export async function requireOrganizer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "organizer") throw new Error("Not authorised");
  return supabase;
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
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "organizer" && profile?.role !== "head_judge") {
    throw new Error("Not authorised");
  }
  return supabase;
}
