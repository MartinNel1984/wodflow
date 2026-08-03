"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { BackHistoryLink } from "@/components/BackLink";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";

const TSHIRT_SIZES = ["S", "M", "L", "XL", "XXL"];

type EventInfo = {
  name: string;
  brandKit: BrandKit | null;
};

export default function JudgeSignupForm() {
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventInfo | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [cell, setCell] = useState("");
  const [tshirtSize, setTshirtSize] = useState("");
  const [judgedBefore, setJudgedBefore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("events")
        .select("name, brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline)")
        .eq("id", eventId)
        .single();

      if (data) {
        const kit = Array.isArray(data.brand_kits) ? data.brand_kits[0] : data.brand_kits;
        setEvent({ name: data.name, brandKit: kit ?? null });
      }
      setLoading(false);
    }
    load();
  }, [eventId]);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().includes("@") &&
    cell.trim().length > 0 &&
    tshirtSize.length > 0 &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/judge-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          cell: cell.trim(),
          tshirtSize,
          judgedBefore,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not submit your application.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;
  if (!event) return <p className="text-center py-20 text-ink/50">Event not found.</p>;

  return (
    <>
      <BackHistoryLink fallbackHref="/" />
      <div className="max-w-xl mx-auto px-4 py-10 space-y-8" style={brandKitStyle(event.brandKit)}>
        <div className="text-center">
          {event.brandKit?.logo_url && <BrandKitLogo kit={event.brandKit} className="h-12 mx-auto mb-3" />}
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-ink/60 text-sm mt-1">Judge signup</p>
        </div>

        {submitted ? (
          <div className="bg-white border border-ink/10 rounded-xl p-6 text-center space-y-1">
            <p className="font-semibold">Thanks — we&apos;ll be in touch.</p>
            <p className="text-ink/60 text-sm">Your application has been sent to the organizer.</p>
          </div>
        ) : (
          <div className="space-y-5 bg-white border border-ink/10 rounded-xl p-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" value={firstName} onChange={setFirstName} />
              <Field label="Surname" value={lastName} onChange={setLastName} />
            </div>
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field label="Cell" value={cell} onChange={setCell} type="tel" />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2">T-shirt size</label>
              <select
                value={tshirtSize}
                onChange={(e) => setTshirtSize(e.target.value)}
                className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
              >
                <option value="">Select a size</option>
                {TSHIRT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={judgedBefore}
                onChange={(e) => setJudgedBefore(e.target.checked)}
                className="rounded"
              />
              I&apos;ve judged before
            </label>

            {error && <p className="text-center text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button
              onClick={submit}
              disabled={!canSubmit}
              className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
        )}
      </div>
    </>
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
