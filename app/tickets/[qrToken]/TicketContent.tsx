"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BackLink } from "@/components/BackLink";

type TicketInfo = {
  ticketType: "spectator" | "weekend_pass";
  buyerName: string;
  quantity: number;
  paymentStatus: "pending" | "paid" | "refunded";
  checkedInCount: number;
  eventName: string | null;
  eventStartDate: string | null;
  eventVenueName: string | null;
};

export default function TicketContent({ qrToken }: { qrToken: string }) {
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/tickets/${qrToken}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json().catch(() => null);
      setTicket(data);
      setLoading(false);
    }
    load();
  }, [qrToken]);

  useEffect(() => {
    // QR encodes the raw token — the checkin scanner resolves it via
    // the same /api/tickets/[qrToken] lookup. Only generated once the
    // ticket is confirmed paid; nothing scannable exists for a payment
    // that never went through (matches "unpaid tickets never get
    // emailed a link" — this covers the direct-URL case too).
    if (ticket?.paymentStatus !== "paid") return;
    QRCode.toDataURL(qrToken, { width: 280, margin: 2 })
      .then(setQrDataUrl)
      .catch((err) => console.error("QR generation failed", err));
  }, [ticket, qrToken]);

  if (loading) return <p className="text-center py-20 text-ink/50">Loading…</p>;
  if (notFound) {
    return (
      <>
        <BackLink href="/all-events" />
        <p className="text-center py-20 text-ink/50">Ticket not found.</p>
      </>
    );
  }
  if (!ticket) return <p className="text-center py-20 text-ink/50">Something went wrong.</p>;

  const typeLabel = ticket.ticketType === "weekend_pass" ? "Weekend pass" : "Day pass";
  const remaining = Math.max(0, ticket.quantity - ticket.checkedInCount);

  return (
    <>
      <BackLink href="/all-events" />
      <div className="max-w-sm mx-auto px-4 py-10 space-y-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">{ticket.eventName ?? "Your ticket"}</h1>
          {ticket.eventVenueName && <p className="text-ink/60 text-sm mt-1">{ticket.eventVenueName}</p>}
          {ticket.eventStartDate && <p className="text-ink/60 text-sm">{ticket.eventStartDate}</p>}
        </div>

        <div className="bg-white border border-ink/10 rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink/50">{typeLabel}</p>
            <p className="text-lg font-semibold">{ticket.buyerName}</p>
            <p className="text-ink/60 text-sm">
              ×{ticket.quantity} {ticket.quantity === 1 ? "ticket" : "tickets"}
            </p>
          </div>

          {ticket.paymentStatus === "pending" && (
            <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-3 text-sm">
              Payment processing — this page will show your QR code as soon as it clears. If this doesn&apos;t
              update within a few minutes, contact the organizer.
            </p>
          )}

          {ticket.paymentStatus === "refunded" && (
            <p className="text-red-700 bg-red-50 rounded-lg px-3 py-3 text-sm">
              This ticket has been refunded and is no longer valid for entry.
            </p>
          )}

          {ticket.paymentStatus === "paid" && (
            <>
              {qrDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Entry QR code" className="mx-auto rounded-lg" width={280} height={280} />
                  {/* A plain data-URL <a download> — works on iOS Safari and
                      Android Chrome without any JS beyond what's already
                      needed to generate the QR, so a spectator who bought
                      weeks ahead can save it to their photo gallery instead
                      of relying on finding the confirmation email again. */}
                  <a
                    href={qrDataUrl}
                    download={`wodflow-ticket-${qrToken}.png`}
                    className="inline-block bg-ink/5 text-ink rounded-lg px-4 py-2 text-sm font-semibold hover-lift"
                  >
                    Save QR code to your phone
                  </a>
                </>
              ) : (
                <p className="text-ink/50 text-sm py-10">Generating QR code…</p>
              )}
              <p className="text-xs text-ink/50">Show this at the gate — a staff member will scan it to check you in.</p>
              <p className="text-sm font-semibold">
                {ticket.checkedInCount} of {ticket.quantity} checked in
                {remaining > 0 ? ` — ${remaining} left to use` : " — fully used"}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
