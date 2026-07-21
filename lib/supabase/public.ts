import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Anon, cookie-free client for public pages (leaderboard, heat sheet).
// The cookie-based server client forces Next.js to treat the route as
// fully dynamic, which makes it ineligible for the KV-backed ISR cache —
// these pages don't need a user session, so this client lets them cache.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
