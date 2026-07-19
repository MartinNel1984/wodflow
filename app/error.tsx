"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-ink/60 text-sm">{error.message || "An unexpected error occurred."}</p>
        <button
          onClick={reset}
          className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
