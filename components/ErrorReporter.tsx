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
];

export function ErrorReporter() {
  useEffect(() => {
    function report(message: string, stack?: string) {
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
