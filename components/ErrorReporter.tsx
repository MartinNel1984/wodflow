"use client";

import { useEffect } from "react";

// Mounted once in the root layout. React's error boundaries (error.tsx,
// global-error.tsx) only catch errors thrown during render — an error
// inside an event handler, a timer, or an un-awaited promise never
// reaches them, so it can fail silently forever unless something else
// is listening. These two listeners are that "something else."
export function ErrorReporter() {
  useEffect(() => {
    function report(message: string, stack?: string) {
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
