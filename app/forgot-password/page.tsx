"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { BackLink } from "@/components/BackLink";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/portal";
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      // Same response either way, on purpose — see route comment.
      setSubmitted(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper py-10">
      <BackLink href={`/athlete-login?next=${encodeURIComponent(next)}`} />
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold"><Logo /></h1>
          <p className="mt-1 text-ink/60 text-sm">Reset your password</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-ink/10 space-y-4">
          {submitted ? (
            <p className="text-center text-sm text-ink/70">
              If that email is registered, we&apos;ve sent a link to reset your password. It expires in
              1 hour.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-ink/40 text-xs">
          <a href={`/athlete-login?next=${encodeURIComponent(next)}`} className="text-accent hover:underline">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
