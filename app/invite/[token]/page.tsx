"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

type InviteInfo = {
  status: string;
  teamName: string | null;
  divisionName: string | null;
  eventName: string | null;
  waiverText: string | null;
  athlete: {
    full_name: string;
    email: string;
    id_number: string | null;
    is_minor: boolean;
    guardian_name: string | null;
    guardian_id_number: string | null;
  } | null;
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianIdNumber, setGuardianIdNumber] = useState("");
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [waiverSignedName, setWaiverSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((data: InviteInfo) => {
        setInvite(data);
        if (data.athlete) {
          setFullName(data.athlete.full_name ?? "");
          setIdNumber(data.athlete.id_number ?? "");
          setIsMinor(data.athlete.is_minor ?? false);
          setGuardianName(data.athlete.guardian_name ?? "");
          setGuardianIdNumber(data.athlete.guardian_id_number ?? "");
        }
      })
      .finally(() => setLoading(false));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setCheckingAuth(false);
    });
  }, [token]);

  async function submit() {
    if (!waiverAccepted || !waiverSignedName.trim() || !fullName.trim() || !idNumber.trim()) return;
    if (isMinor && (!guardianName.trim() || !guardianIdNumber.trim())) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          idNumber,
          isMinor,
          guardianName,
          guardianIdNumber,
          waiverAccepted,
          waiverSignedName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not confirm your details.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading || checkingAuth) return <p className="text-center py-20 text-ink/50">Loading…</p>;
  // `athlete` is only present once signed in (its PII is auth-gated server-
  // side), so validity is checked via `status` instead — present for any
  // real invite, absent on a 404.
  if (!invite || !invite.status) {
    return <p className="text-center py-20 text-red-700">Invite not found.</p>;
  }

  const nextParam = `/invite/${token}`;

  return (
    <div className="max-w-md mx-auto px-4 py-10 space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold"><Logo /></h1>
        <p className="text-ink/60 text-sm mt-1">Team invite</p>
      </div>

      <div className="bg-white border border-ink/10 rounded-xl p-4">
        <p className="font-semibold">{invite.eventName}</p>
        <p className="text-ink/60 text-sm">
          {invite.divisionName}
          {invite.teamName ? ` · ${invite.teamName}` : ""}
        </p>
      </div>

      {invite.status === "accepted" ? (
        <p className="text-center text-green-700 text-sm bg-green-50 rounded-lg px-3 py-3">
          This invite has already been claimed.
        </p>
      ) : done ? (
        <p className="text-center text-green-700 text-sm bg-green-50 rounded-lg px-3 py-3">
          You&apos;re all set — your details and waiver are confirmed.
        </p>
      ) : !signedIn ? (
        <div className="space-y-3">
          <p className="text-ink/70 text-sm">
            Sign in or create an account to confirm your details and sign your own waiver.
          </p>
          <a
            href={`/athlete-login?next=${encodeURIComponent(nextParam)}`}
            className="block w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold text-center"
          >
            Sign in
          </a>
          <a
            href={`/athlete-signup?next=${encodeURIComponent(nextParam)}`}
            className="block w-full bg-white border border-ink/10 rounded-lg py-3 text-sm font-semibold text-center"
          >
            Create an account
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Full name" value={fullName} onChange={setFullName} />
          <Field label="ID number" value={idNumber} onChange={setIdNumber} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
            Under 18 — a parent/guardian must sign
          </label>
          {isMinor && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Parent/guardian full name" value={guardianName} onChange={setGuardianName} />
              <Field label="Parent/guardian ID number" value={guardianIdNumber} onChange={setGuardianIdNumber} />
            </div>
          )}

          <div>
            <h2 className="font-semibold text-sm mb-2">Waiver</h2>
            <div className="bg-white border border-ink/10 rounded-xl p-4 text-sm text-ink/80 max-h-64 overflow-y-auto whitespace-pre-wrap">
              {invite.waiverText || "No waiver text has been set for this event yet."}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={waiverAccepted}
              onChange={(e) => setWaiverAccepted(e.target.checked)}
              className="mt-1"
            />
            I have read and agree to the waiver above.
          </label>

          <Field label="Type your full name to sign" value={waiverSignedName} onChange={setWaiverSignedName} />

          {error && (
            <p className="text-center text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={submitting || !waiverAccepted || !waiverSignedName.trim()}
            className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Confirm my details"}
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
