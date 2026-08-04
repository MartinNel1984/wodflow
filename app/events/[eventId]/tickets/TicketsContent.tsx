"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { BackHistoryLink } from "@/components/BackLink";
import { RumbleBackdrop } from "@/components/RumbleBackdrop";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";

// Mirrors events.max_tickets_per_order's default (migration-046). The
// server reads the real per-event value; this is the UI's safe default.
const MAX_PER_ORDER = 20;

type TicketType = "spectator" | "weekend_pass";

type EventInfo = {
  name: string;
  description: string | null;
  posterUrl: string | null;
  brandKit: BrandKit | null;
  spectatorPrice: number | null;
  weekendPassPrice: number | null;
};

export default function TicketsContent() {
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventInfo | null>(null);

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [ticketType, setTicketType] = useState<TicketType>("spectator");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("events")
        .select(
          "name, description, poster_url, spectator_price, weekend_pass_price, brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline)"
        )
        .eq("id", eventId)
        .single();

      if (data) {
        const kit = Array.isArray(data.brand_kits) ? data.brand_kits[0] : data.brand_kits;
        setEvent({
          name: data.name,
          description: data.description,
          posterUrl: data.poster_url,
          brandKit: kit ?? null,
          spectatorPrice: data.spectator_price,
          weekendPassPrice: data.weekend_pass_price,
        });
        // Default to whichever type is actually on sale; day pass wins
        // when both are (matches its position as the first option).
        if (data.spectator_price == null && data.weekend_pass_price != null) {
          setTicketType("weekend_pass");
        }
      }
      setLoading(false);
    }
    load();
  }, [eventId]);

  const dayPassAvailable = event?.spectatorPrice != null;
  const weekendPassAvailable = event?.weekendPassPrice != null;
  const unitPrice = ticketType === "weekend_pass" ? event?.weekendPassPrice ?? null : event?.spectatorPrice ?? null;
  const total = unitPrice != null ? unitPrice * quantity : 0;

  const canSubmit = buyerName.trim().length > 0 && buyerEmail.trim().includes("@") && quantity >= 1 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          ticketType,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          quantity,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not start checkout.");
        setSubmitting(false);
        return;
      }
      window.location.assign(data.payUrl);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;
  if (!event) return <p className="text-center py-20 text-ink/50">Event not found.</p>;

  const isBigOne = event.brandKit?.name === "Rumble Big One";

  const content = (
      <div className="max-w-xl mx-auto px-4 py-10 space-y-8" style={brandKitStyle(event.brandKit)}>
        {event.posterUrl && !isBigOne ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.posterUrl}
            alt={event.name}
            className="w-full aspect-video object-cover rounded-xl animate-settle-in"
          />
        ) : (
          !isBigOne && event.brandKit?.logo_url && <BrandKitLogo kit={event.brandKit} className="h-12 mx-auto mb-3" />
        )}

        <div className="text-center">
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-ink/60 text-sm mt-1">Spectator tickets</p>
          {event.description && <p className="text-ink/70 text-sm mt-3 max-w-md mx-auto">{event.description}</p>}
        </div>

        <div className="space-y-5 bg-white border border-ink/10 rounded-xl p-5">
          {dayPassAvailable && weekendPassAvailable && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Ticket type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTicketType("spectator")}
                  className={`rounded-lg border px-3 py-2 text-sm text-left ${
                    ticketType === "spectator" ? "border-accent bg-accent/5 font-semibold" : "border-ink/10"
                  }`}
                >
                  Day pass
                  <span className="block text-ink/60 text-xs font-normal">R{event?.spectatorPrice}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTicketType("weekend_pass")}
                  className={`rounded-lg border px-3 py-2 text-sm text-left ${
                    ticketType === "weekend_pass" ? "border-accent bg-accent/5 font-semibold" : "border-ink/10"
                  }`}
                >
                  Weekend pass
                  <span className="block text-ink/60 text-xs font-normal">R{event?.weekendPassPrice}</span>
                </button>
              </div>
            </div>
          )}

          <Field label="Full name" value={buyerName} onChange={setBuyerName} />
          <Field label="Email" value={buyerEmail} onChange={setBuyerEmail} type="email" />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Quantity</label>
            {/* Clamped to MAX_PER_ORDER so a typo (100 instead of 10)
                can't silently become a five-figure checkout. The server
                and the enforce_spectator_capacity trigger both re-check
                this — the clamp here is just immediate feedback. */}
            <input
              type="number"
              min={1}
              max={MAX_PER_ORDER}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.min(MAX_PER_ORDER, Math.max(1, Math.floor(Number(e.target.value) || 1))))
              }
              className="w-24 bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>

          {unitPrice != null && (
            <div className="flex items-center justify-between border-t border-ink/10 pt-3 text-sm">
              <span className="text-ink/60">
                {quantity} × R{unitPrice}
              </span>
              <span className="font-semibold">Total: R{total.toFixed(2)}</span>
            </div>
          )}

          {error && <p className="text-center text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
          >
            {submitting ? "Redirecting to payment…" : unitPrice != null ? `Pay R${total.toFixed(2)}` : "Pay"}
          </button>
        </div>
      </div>
  );

  if (isBigOne) {
    return (
      <RumbleBackdrop
        logoSrc={event.brandKit?.logo_url || "/rumble/series-logo-v2.png"}
        logoAlt={event.brandKit?.name || "Rumble Big One"}
        backHref="/tickets"
        useHistoryBack
      >
        <div className="w-full max-w-xl bg-white text-ink rounded-2xl shadow-xl">{content}</div>
      </RumbleBackdrop>
    );
  }

  return (
    <>
      <BackHistoryLink fallbackHref="/tickets" />
      {content}
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
