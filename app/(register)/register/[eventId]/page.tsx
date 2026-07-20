"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";

type Division = {
  id: string;
  name: string;
  team_size: number;
  price_early: number | null;
  price_normal: number;
  price_late: number | null;
};

type Teammate = {
  fullName: string;
  email: string;
  idNumber: string;
  isMinor: boolean;
  guardianName: string;
  guardianIdNumber: string;
};

function emptyTeammate(): Teammate {
  return { fullName: "", email: "", idNumber: "", isMinor: false, guardianName: "", guardianIdNumber: "" };
}

export default function RegisterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [eventName, setEventName] = useState("");
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [waiverText, setWaiverText] = useState("");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);

  const [divisionId, setDivisionId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teammates, setTeammates] = useState<Teammate[]>([emptyTeammate()]);
  const [waiverSignedName, setWaiverSignedName] = useState("");
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [athleteProfile, setAthleteProfile] = useState<Partial<Teammate> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAthleteProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name, email, id_number")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "athlete") return;
      setAthleteProfile({
        fullName: profile.full_name ?? "",
        email: profile.email ?? "",
        idNumber: profile.id_number ?? "",
      });
    }
    loadAthleteProfile();
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: event }, { data: divs }] = await Promise.all([
        supabase
          .from("events")
          .select(
            "name, waiver_text, brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline)"
          )
          .eq("id", eventId)
          .single(),
        supabase
          .from("divisions")
          .select("id, name, team_size, price_early, price_normal, price_late")
          .eq("event_id", eventId)
          .order("name"),
      ]);
      setEventName(event?.name ?? "");
      const kit = Array.isArray(event?.brand_kits) ? event.brand_kits[0] : event?.brand_kits;
      setBrandKit(kit ?? null);
      setWaiverText(event?.waiver_text ?? "");
      setDivisions(divs ?? []);
      setLoading(false);
    }
    load();
  }, [eventId]);

  const selectedDivision = divisions.find((d) => d.id === divisionId);

  function selectDivision(d: Division) {
    setDivisionId(d.id);
    setTeammates(
      Array.from({ length: d.team_size }, (_, i) =>
        i === 0 && athleteProfile ? { ...emptyTeammate(), ...athleteProfile } : emptyTeammate()
      )
    );
    setStep(2);
  }

  function updateTeammate(index: number, field: keyof Teammate, value: string | boolean) {
    setTeammates((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  function teammatesValid() {
    return teammates.every(
      (t) =>
        t.fullName.trim() &&
        t.email.trim().includes("@") &&
        t.idNumber.trim() &&
        (!t.isMinor || (t.guardianName.trim() && t.guardianIdNumber.trim()))
    );
  }

  async function submitRegistration() {
    if (!selectedDivision || !waiverAccepted || !waiverSignedName.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionId: selectedDivision.id,
          teamName: selectedDivision.team_size > 1 ? teamName : null,
          teammates: teammates.map((t, i) => ({ ...t, isCaptain: i === 0 })),
          waiverSignedName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.payUrl;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-8" style={brandKitStyle(brandKit)}>
      <div className="text-center">
        {brandKit?.logo_url && <BrandKitLogo kit={brandKit} className="h-12 mx-auto mb-3" />}
        <h1 className="text-2xl font-semibold">{eventName}</h1>
        <p className="text-ink/60 text-sm mt-1">Register</p>
        {athleteProfile ? (
          <p className="text-accent text-xs mt-2">Signed in as {athleteProfile.fullName} — details pre-filled</p>
        ) : (
          <p className="text-ink/40 text-xs mt-2">
            <a href="/athlete-login" className="hover:underline">
              Sign in
            </a>{" "}
            to pre-fill your details and track your registrations
          </p>
        )}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Choose your division</h2>
          {divisions.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDivision(d)}
              className="w-full text-left bg-white border border-ink/10 rounded-xl px-4 py-3 hover:bg-ink/5 transition-colors"
            >
              <p className="font-semibold">{d.name}</p>
              <p className="text-ink/60 text-sm">
                {d.team_size === 1 ? "Individual" : `Team of ${d.team_size}`} · R{d.price_normal}
              </p>
            </button>
          ))}
        </div>
      )}

      {step === 2 && selectedDivision && (
        <div className="space-y-5">
          <button onClick={() => setStep(1)} className="text-accent text-sm hover:underline">
            ← Change division
          </button>
          <h2 className="font-semibold">{selectedDivision.name}</h2>

          {selectedDivision.team_size > 1 && (
            <Field label="Team name" value={teamName} onChange={setTeamName} />
          )}

          {teammates.map((t, i) => (
            <div key={i} className="space-y-3 border-b border-ink/10 pb-4 last:border-0">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={i === 0 ? "Your full name (captain)" : `Teammate ${i + 1} full name`}
                  value={t.fullName}
                  onChange={(v) => updateTeammate(i, "fullName", v)}
                />
                <Field
                  label={i === 0 ? "Your email" : `Teammate ${i + 1} email`}
                  value={t.email}
                  onChange={(v) => updateTeammate(i, "email", v)}
                  type="email"
                />
              </div>
              <Field
                label="ID number"
                value={t.idNumber}
                onChange={(v) => updateTeammate(i, "idNumber", v)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.isMinor}
                  onChange={(e) => updateTeammate(i, "isMinor", e.target.checked)}
                />
                Under 18 — a parent/guardian must sign
              </label>
              {t.isMinor && (
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Parent/guardian full name"
                    value={t.guardianName}
                    onChange={(v) => updateTeammate(i, "guardianName", v)}
                  />
                  <Field
                    label="Parent/guardian ID number"
                    value={t.guardianIdNumber}
                    onChange={(v) => updateTeammate(i, "guardianIdNumber", v)}
                  />
                </div>
              )}
            </div>
          ))}

          <button
            onClick={() => teammatesValid() && setStep(3)}
            disabled={!teammatesValid()}
            className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
          >
            Continue to waiver
          </button>
        </div>
      )}

      {step === 3 && selectedDivision && (
        <div className="space-y-5">
          <button onClick={() => setStep(2)} className="text-accent text-sm hover:underline">
            ← Back
          </button>
          <h2 className="font-semibold">Waiver</h2>
          <div className="bg-white border border-ink/10 rounded-xl p-4 text-sm text-ink/80 max-h-64 overflow-y-auto whitespace-pre-wrap">
            {waiverText || "No waiver text has been set for this event yet."}
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

          <Field
            label="Type your full name to sign"
            value={waiverSignedName}
            onChange={setWaiverSignedName}
          />

          {error && (
            <p className="text-center text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={submitRegistration}
            disabled={submitting || !waiverAccepted || !waiverSignedName.trim()}
            className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
          >
            {submitting ? "Redirecting to payment…" : `Pay R${selectedDivision.price_normal} & register`}
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
      />
    </div>
  );
}
