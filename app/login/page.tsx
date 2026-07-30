"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { BackLink } from "@/components/BackLink";

// Organizer login. Athletes don't use this page — they sign up as
// part of the registration wizard instead.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // platform_admin can't reach /dashboard (organizer-only, see
    // (admin)/layout.tsx) — sending it there anyway bounced straight back
    // to /login, which looked identical to a failed sign-in.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    router.push(profile?.role === "platform_admin" ? "/platform/control" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="graffiti-page min-h-screen flex items-center justify-center">
      <BackLink href="/all-events" />
      <div className="graffiti-photos" aria-hidden="true">
        {/* eslint-disable @next/next/no-img-element */}
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <img key={n} src={`/mural/action-${n}.jpg`} alt="" />
        ))}
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      <div className="graffiti-hex" aria-hidden="true" />
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold"><Logo /></h1>
          <p className="text-script text-lg mt-2 text-paper">Feel the flow. Chase the clock.</p>
          <p className="mt-1 text-paper/60 text-sm">Organizer sign-in</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white text-ink rounded-2xl p-6 shadow-xl border-2 border-ink space-y-5"
        >
          {error && (
            <p className="text-center text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
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
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-paper/50 text-xs">
          Judge?{" "}
          <a href="/judge-login" className="text-accent hover:underline">
            Sign in here
          </a>
        </p>
      </div>
    </div>
  );
}
