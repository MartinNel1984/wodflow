"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { RumbleBackdrop } from "@/components/RumbleBackdrop";
import { BackLink } from "@/components/BackLink";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";
import { currentPrice } from "@/lib/pricing";

type Division = {
  id: string;
  name: string;
  team_size: number;
  price_early: number | null;
  price_normal: number;
  price_late: number | null;
  early_bird_ends: string | null;
  late_starts: string | null;
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

export default function RegisterContent() {
  const { eventId } = useParams<{ eventId: string }>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [eventName, setEventName] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [waiverText, setWaiverText] = useState("");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [ticketsAvailable, setTicketsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const [divisionId, setDivisionId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teammates, setTeammates] = useState<Teammate[]>([emptyTeammate()]);
  const [waiverSignedName, setWaiverSignedName] = useState("");
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [athleteProfile, setAthleteProfile] = useState<Partial<Teammate> | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState("");

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
            "name, waiver_text, poster_url, spectator_price, weekend_pass_price, brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline)"
          )
          .eq("id", eventId)
          .single(),
        supabase
          .from("divisions")
          .select("id, name, team_size, price_early, price_normal, price_late, early_bird_ends, late_starts")
          .eq("event_id", eventId)
          .order("name"),
      ]);
      setEventName(event?.name ?? "");
      setPosterUrl(event?.poster_url ?? "");
      const kit = Array.isArray(event?.brand_kits) ? event.brand_kits[0] : event?.brand_kits;
      setBrandKit(kit ?? null);
      setWaiverText(event?.waiver_text ?? "");
      setTicketsAvailable(event?.spectator_price != null || event?.weekend_pass_price != null);
      // "RX Test" is leftover rehearsal data on the real Big One event — same exclusion as lib/rumbleHub.ts
      setDivisions((divs ?? []).filter((d) => d.name !== "RX Test"));
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
    return !teammatesError();
  }

  // Catches the "too lazy to find his partner's details, entered himself
  // twice" case — same email or same ID number used for two lanes on one
  // team registration.
  function teammatesError(): string {
    const allFieldsFilled = teammates.every(
      (t) =>
        t.fullName.trim() &&
        t.email.trim().includes("@") &&
        t.idNumber.trim() &&
        (!t.isMinor || (t.guardianName.trim() && t.guardianIdNumber.trim()))
    );
    if (!allFieldsFilled) return "";

    const emails = teammates.map((t) => t.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      return "Each teammate needs their own email address — two lanes have the same one.";
    }
    const idNumbers = teammates.map((t) => t.idNumber.trim());
    if (new Set(idNumbers).size !== idNumbers.length) {
      return "Each teammate needs their own ID number — two lanes have the same one.";
    }
    return "";
  }

  async function continueToWaiver() {
    if (!teammatesValid()) return;

    // The captain needs an account before registering — teammates get
    // their own via the invite link sent after registration. Skip
    // account creation entirely if they're already signed in.
    if (athleteProfile) {
      setStep(3);
      return;
    }

    if (password.length < 8) {
      setAccountError("Please choose a password of at least 8 characters.");
      return;
    }

    setCreatingAccount(true);
    setAccountError("");
    try {
      const captain = teammates[0];
      const res = await fetch("/api/auth/athlete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: captain.fullName,
          email: captain.email,
          password,
          idNumber: captain.idNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Most likely a returning athlete who already has an account but
        // isn't signed in — point them at sign-in instead of a dead end.
        const alreadyExists = (data.error ?? "").toLowerCase().includes("already");
        setAccountError(
          alreadyExists
            ? "You already have a Wodflow account with this email — please sign in above instead."
            : data.error ?? "Could not create your account."
        );
        setCreatingAccount(false);
        return;
      }
      setAthleteProfile({ fullName: captain.fullName, email: captain.email, idNumber: captain.idNumber });
      setStep(3);
    } catch {
      setAccountError("Network error. Please try again.");
    } finally {
      setCreatingAccount(false);
    }
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
      // .assign() rather than `location.href = …` — same full-page
      // navigation to PayFast, but not an assignment to an external
      // binding, which the react-hooks/immutability rule flags.
      window.location.assign(data.payUrl);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;

  const isBigOne = brandKit?.name === "Rumble Big One";

  const content = (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-8" style={brandKitStyle(brandKit)}>
      {posterUrl && !isBigOne && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt={eventName}
          className="w-full aspect-video object-cover rounded-xl animate-settle-in"
        />
      )}
      <div className="text-center">
        {!posterUrl && brandKit?.logo_url && <BrandKitLogo kit={brandKit} className="h-12 mx-auto mb-3" />}
        <h1 className="text-2xl font-semibold">{eventName}</h1>
        <p className="text-ink/60 text-sm mt-1">Register</p>
        {ticketsAvailable && (
          <p className="mt-2">
            <a href={`/events/${eventId}/tickets`} className="text-accent text-sm font-semibold hover:underline">
              Not competing? Get a spectator pass →
            </a>
          </p>
        )}
        {athleteProfile ? (
          <p className="text-accent text-xs mt-2">Signed in as {athleteProfile.fullName} — details pre-filled</p>
        ) : (
          <p className="text-ink/40 text-xs mt-2">
            <a
              href={`/athlete-login?next=/register/${eventId}`}
              className="text-accent font-semibold hover:underline"
            >
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
                {d.team_size === 1 ? "Individual" : `Team of ${d.team_size}`} · R{currentPrice(d)}
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
                  label={i === 0 ? "Name & surname (captain)" : `Teammate ${i + 1} name & surname`}
                  value={t.fullName}
                  onChange={(v) => updateTeammate(i, "fullName", v)}
                  twoLineLabel
                />
                <Field
                  label={i === 0 ? "Your email" : `Teammate ${i + 1} email`}
                  value={t.email}
                  onChange={(v) => updateTeammate(i, "email", v)}
                  type="email"
                  twoLineLabel
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

          {teammatesError() && (
            <p className="text-center text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">{teammatesError()}</p>
          )}

          {!athleteProfile && (
            <div className="space-y-2 border-t border-ink/10 pt-4">
              <p className="text-sm font-semibold">Create your account</p>
              <p className="text-ink/60 text-xs">
                Used to track your registrations and see your heat times once published.{" "}
                <a href={`/athlete-login?next=/register/${eventId}`} className="text-accent hover:underline">
                  Already have an account? Sign in.
                </a>
              </p>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
                  Password (8+ characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-paper rounded-lg pl-4 pr-16 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-accent"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {accountError && (
            <p className="text-center text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">{accountError}</p>
          )}

          <button
            onClick={continueToWaiver}
            disabled={!teammatesValid() || creatingAccount || (!athleteProfile && password.length < 8)}
            className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
          >
            {creatingAccount ? "Creating account…" : "Continue to waiver"}
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
            {submitting ? "Redirecting to payment…" : `Pay R${currentPrice(selectedDivision)} & register`}
          </button>
        </div>
      )}
    </div>
  );

  if (isBigOne) {
    return (
      <RumbleBackdrop
        logoSrc={brandKit?.logo_url || "/rumble/series-logo-v2.png"}
        logoAlt={brandKit?.name || "Rumble Big One"}
        backHref="/all-events"
      >
        <div className="w-full max-w-xl bg-white text-ink rounded-2xl shadow-xl">{content}</div>
      </RumbleBackdrop>
    );
  }

  return (
    <>
      <BackLink href={`/events/${eventId}`} />
      {content}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  twoLineLabel = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  // Reserves 2 lines of label height regardless of how many lines this
  // particular label actually wraps to, so a short sibling label in the
  // same grid row (e.g. "Your email" next to "Name & surname (captain)")
  // doesn't leave its input sitting higher than the wrapped one's.
  twoLineLabel?: boolean;
}) {
  return (
    <div>
      <label
        className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${twoLineLabel ? "min-h-[2rem]" : ""}`}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
      />
    </div>
  );
}
