"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Judge = {
  id: string;
  full_name: string | null;
};

export default function JudgeLoginPage() {
  const router = useRouter();

  const [judges, setJudges] = useState<Judge[]>([]);
  const [loadingJudges, setLoadingJudges] = useState(true);
  const [selected, setSelected] = useState<Judge | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const filteredJudges = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return judges;
    return judges.filter((j) => (j.full_name ?? "").toLowerCase().includes(q));
  }, [judges, query]);

  useEffect(() => {
    fetch("/api/auth/judge-list")
      .then((r) => r.json())
      .then((d) => setJudges(d.judges ?? []))
      .catch(() => setJudges([]))
      .finally(() => setLoadingJudges(false));
  }, []);

  async function submitPin(fullPin: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: selected.id, pin: fullPin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        setPin("");
        setBusy(false);
        return;
      }
      router.push("/score");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPin("");
      setBusy(false);
    }
  }

  function pressDigit(d: string) {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError("");
    if (next.length === 4) submitPin(next);
  }

  function backspace() {
    if (busy) return;
    setPin((p) => p.slice(0, -1));
  }

  function chooseJudge(j: Judge) {
    setSelected(j);
    setPin("");
    setError("");
  }

  function backToNames() {
    setSelected(null);
    setPin("");
    setError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Wodflow</h1>
          <p className="mt-1 text-ink/60 text-sm">Judge sign-in</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl border border-ink/10">
          {!selected ? (
            <div className="space-y-3">
              <h2 className="text-center font-semibold">Who&apos;s judging?</h2>
              {!loadingJudges && judges.length > 0 && (
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your name…"
                  autoFocus
                  className="w-full bg-paper rounded-xl px-3 py-2.5 text-sm border border-ink/10 focus:outline-none focus:border-accent"
                />
              )}
              {loadingJudges ? (
                <p className="text-center text-ink/50 text-sm py-6">Loading…</p>
              ) : judges.length === 0 ? (
                <p className="text-center text-ink/60 text-sm py-6">
                  No judges set up yet — ask the organizer.
                </p>
              ) : filteredJudges.length === 0 ? (
                <p className="text-center text-ink/60 text-sm py-6">No match.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                  {filteredJudges.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => chooseJudge(j)}
                      className="w-full bg-paper hover:bg-ink/5 border border-ink/10 rounded-xl px-4 py-3 text-left font-semibold text-sm transition-colors"
                    >
                      {j.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <button
                  onClick={backToNames}
                  className="text-accent text-xs font-semibold mb-3 hover:underline"
                >
                  ← Not you?
                </button>
                <p className="font-semibold">Hi {selected.full_name?.split(" ")[0]}</p>
                <p className="text-ink/60 text-sm">Enter your 4-digit PIN</p>
              </div>

              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-colors ${
                      pin.length > i ? "bg-accent border-accent" : "border-ink/20 bg-transparent"
                    }`}
                  />
                ))}
              </div>

              {error && (
                <p className="text-center text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <KeypadButton key={d} onClick={() => pressDigit(d)} disabled={busy}>
                    {d}
                  </KeypadButton>
                ))}
                <div />
                <KeypadButton onClick={() => pressDigit("0")} disabled={busy}>
                  0
                </KeypadButton>
                <KeypadButton onClick={backspace} disabled={busy || pin.length === 0}>
                  ⌫
                </KeypadButton>
              </div>

              {busy && <p className="text-center text-ink/50 text-sm">Signing in…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-14 rounded-xl bg-paper hover:bg-ink/5 active:bg-ink/10 disabled:opacity-40 border border-ink/10 text-xl font-semibold transition-colors"
    >
      {children}
    </button>
  );
}
