"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { BackLink } from "@/components/BackLink";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";

type EventInfo = {
  name: string;
  description: string | null;
  posterUrl: string | null;
  brandKit: BrandKit | null;
  spectatorPrice: number | null;
  vendorPrice: number | null;
};

type TicketType = "spectator" | "vendor";

export default function TicketsContent() {
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventInfo | null>(null);

  const [ticketType, setTicketType] = useState<TicketType | "">("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("events")
        .select(
          "name, description, poster_url, spectator_price, vendor_price, brand_kits(id, name, logo_url, color_primary, color_secondary, color_accent, tagline)"
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
          vendorPrice: data.vendor_price,
        });
        // Default to whichever single type is available so the buyer
        // doesn't have to pick when there's only one real option.
        if (data.spectator_price != null && data.vendor_price == null) setTicketType("spectator");
        else if (data.vendor_price != null && data.spectator_price == null) setTicketType("vendor");
      }
      setLoading(false);
    }
    load();
  }, [eventId]);

  const unitPrice =
    ticketType === "spectator" ? event?.spectatorPrice : ticketType === "vendor" ? event?.vendorPrice : null;
  const total = unitPrice != null ? unitPrice * quantity : 0;

  const canSubmit =
    !!ticketType && buyerName.trim().length > 0 && buyerEmail.trim().includes("@") && quantity >= 1 && !submitting;

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
      window.location.href = data.payUrl;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;
  if (!event) return <p className="text-center py-20 text-ink/50">Event not found.</p>;

  const bothAvailable = event.spectatorPrice != null && event.vendorPrice != null;

  return (
    <>
      <BackLink href={`/register/${eventId}`} />
      <div className="max-w-xl mx-auto px-4 py-10 space-y-8" style={brandKitStyle(event.brandKit)}>
        {event.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.posterUrl}
            alt={event.name}
            className="w-full aspect-video object-cover rounded-xl animate-settle-in"
          />
        ) : (
          event.brandKit?.logo_url && <BrandKitLogo kit={event.brandKit} className="h-12 mx-auto mb-3" />
        )}

        <div className="text-center">
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-ink/60 text-sm mt-1">Spectator &amp; vendor tickets</p>
          {event.description && <p className="text-ink/70 text-sm mt-3 max-w-md mx-auto">{event.description}</p>}
        </div>

        <div className="space-y-5 bg-white border border-ink/10 rounded-xl p-5">
          {bothAvailable && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider">Ticket type</p>
              <div className="grid grid-cols-2 gap-3">
                <TypeButton
                  label="Spectator"
                  price={event.spectatorPrice}
                  selected={ticketType === "spectator"}
                  onClick={() => setTicketType("spectator")}
                />
                <TypeButton
                  label="Vendor"
                  price={event.vendorPrice}
                  selected={ticketType === "vendor"}
                  onClick={() => setTicketType("vendor")}
                />
              </div>
            </div>
          )}

          <Field label="Full name" value={buyerName} onChange={setBuyerName} />
          <Field label="Email" value={buyerEmail} onChange={setBuyerEmail} type="email" />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
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
    </>
  );
}

function TypeButton({
  label,
  price,
  selected,
  onClick,
}: {
  label: string;
  price: number | null;
  selected: boolean;
  onClick: () => void;
}) {
  if (price == null) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl px-4 py-3 border-2 transition-colors ${
        selected ? "border-accent bg-accent/5" : "border-ink/10 hover:border-ink/30"
      }`}
    >
      <p className="font-semibold">{label}</p>
      <p className="text-ink/60 text-sm">R{price} each</p>
    </button>
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
