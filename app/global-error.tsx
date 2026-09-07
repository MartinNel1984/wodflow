"use client";

import { useEffect } from "react";

// Safety net for errors in the root layout itself — global-error
// replaces the whole document when active, so it must define its own
// <html>/<body> (see app/error.tsx for the normal route-level boundary).
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        route: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-sm text-center space-y-4">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-ink/60 text-sm">Please refresh the page.</p>
            <button
              onClick={retry}
              className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
