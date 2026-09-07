import { createServiceClient } from "@/lib/supabase/service";

type ErrorSource = "client" | "server_action" | "api_route" | "server_component";

async function fingerprint(message: string, route: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${message}|${route}`)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

// Never throws — a logging failure must not break the caller's real
// error handling (or, for client-reported errors, the request itself).
// Same "swallow and console.error" shape as logEmailAttempt() in
// lib/email.ts.
export async function logError(
  error: unknown,
  context: {
    source: ErrorSource;
    route?: string;
    severity?: "error" | "warning";
    stack?: string;
    extra?: Record<string, unknown>;
  }
) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = context.stack ?? (error instanceof Error ? error.stack : undefined);
    const route = context.route ?? "unknown";
    const fp = await fingerprint(message, route);
    const supabase = createServiceClient();

    const { error: insertError } = await supabase.from("error_logs").insert({
      fingerprint: fp,
      message,
      stack: stack ?? null,
      route,
      source: context.source,
      severity: context.severity ?? "error",
      context: context.extra ?? null,
    });

    // 23505 = unique violation on the "one open row per fingerprint"
    // index — this exact error is already logged and unresolved, so
    // bump its counter instead of creating a duplicate row.
    if (insertError?.code === "23505") {
      await supabase.rpc("bump_error_log", { p_fingerprint: fp });
    }
  } catch (err) {
    console.error("logError failed", err);
  }
}
