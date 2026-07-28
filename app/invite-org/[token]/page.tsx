"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

type InviteInfo = {
  status: string;
  email: string;
  role: string;
  organizationName: string | null;
};

export default function InviteOrgPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/org-invites/${token}`)
      .then((r) => r.json())
      .then(setInvite)
      .finally(() => setLoading(false));
  }, [token]);

  async function submit() {
    if (!fullName.trim() || password.length < 8) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/org-invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create your account.");
        setSubmitting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;
  if (!invite || !invite.status) {
    return <p className="text-center py-20 text-red-700">Invite not found.</p>;
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-10 space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">
          <Logo />
        </h1>
        <p className="text-ink/60 text-sm mt-1">Set up your Wodflow account</p>
      </div>

      <div className="bg-white border border-ink/10 rounded-xl p-4 text-center">
        <p className="font-semibold">{invite.organizationName}</p>
        <p className="text-ink/60 text-sm">
          {invite.role.replace("_", " ")} access for {invite.email}
        </p>
      </div>

      {invite.status === "accepted" ? (
        <p className="text-center text-green-700 text-sm bg-green-50 rounded-lg px-3 py-3">
          This invite has already been used. <a href="/login" className="underline">Sign in instead.</a>
        </p>
      ) : (
        <div className="space-y-4">
          <Field label="Your full name" value={fullName} onChange={setFullName} />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Choose a password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
            <p className="text-ink/40 text-xs mt-1">At least 8 characters.</p>
          </div>

          {error && (
            <p className="text-center text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={submitting || !fullName.trim() || password.length < 8}
            className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
          >
            {submitting ? "Setting up…" : "Create my account"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
      />
    </div>
  );
}
