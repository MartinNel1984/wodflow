"use client";

import { useEffect } from "react";

// Mounted once in the root layout. React's error boundaries (error.tsx,
// global-error.tsx) only catch errors thrown during render — an error
// inside an event handler, a timer, or an un-awaited promise never
// reaches them, so it can fail silently forever unless something else
// is listening. These two listeners are that "something else."
// Errors injected by third-party in-app browsers (Instagram/Facebook/TikTok
// on Android, Safari-based in-app browsers on iOS) that have nothing to do
// with Wodflow's own code — their native JS bridge throws when its WebView
// is torn down mid-callback. Filtered here so they don't spam alerts.
const NOISE_PATTERNS = [
  /Error invoking postMessage/i,
  /window\.webkit\.messageHandlers/i,
  /^Script error\.?$/i,
  // Native-bridge call from an in-app browser's injected script, not our code.
  /Object Not Found Matching Id:\d+, MethodName:/i,
];

// A page opened before a deploy calls a server action ID the new build
// no longer has. Not a bug, but the page is dead until refreshed, so
// reload once (guarded so a persistent failure can't loop).
const STALE_ACTION = /Server Action .* was not found on the server/i;
const RELOAD_KEY = "wodflow:stale-action-reload";

export function ErrorReporter() {
  useEffect(() => {
    function report(message: string, stack?: string) {
      if (STALE_ACTION.test(message)) {
        try {
          const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
          if (Date.now() - last > 30_000) {
            sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
            window.location.reload();
          }
        } catch {
          // sessionStorage unavailable; skip the reload rather than risk a loop.
        }
        return;
      }
      if (NOISE_PATTERNS.some((pattern) => pattern.test(message))) return;
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, stack, route: window.location.pathname }),
        keepalive: true,
      }).catch(() => {
        // Nothing to do if the report itself can't be delivered.
      });
    }

    function onError(event: ErrorEvent) {
      report(event.message, event.error?.stack);
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      report(message, reason instanceof Error ? reason.stack : undefined);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
