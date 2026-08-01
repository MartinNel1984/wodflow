"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { lookupTicket, confirmCheckin } from "./actions";

type Ticket = {
  id: string;
  ticket_type: "spectator" | "vendor";
  buyer_name: string;
  quantity: number;
  checked_in_count: number;
  payment_status: "pending" | "paid" | "refunded";
};

// BarcodeDetector is Chrome/Android-only as of this writing (no Safari/
// iOS support) — see the manual-entry fallback below for the documented
// gap rather than pulling in a full JS-decode library (jsQR etc.) for
// what's a stopgap until wider browser support lands.
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
    };
  }
}

export default function CheckinPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [role, setRole] = useState<string>("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  // Doesn't change after mount — a lazy initializer avoids the
  // render-then-immediately-setState-in-an-effect pattern for a value
  // that's static for the life of the page.
  const [cameraSupported] = useState(() => typeof window !== "undefined" && "BarcodeDetector" in window);
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAuthorized(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const r = profile?.role ?? "";
      setRole(r);
      // Checkin is organizer/head_judge only (requirePrivileged on the
      // server side already enforces this on every action) — a plain
      // judge landing here via the shared (judge) route group gets
      // bounced with a message rather than a confusing blank scanner.
      setAuthorized(r === "organizer" || r === "head_judge");
    }
    loadRole();
  }, []);

  const stopScanning = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const handleScanValue = useCallback(
    async (value: string) => {
      stopScanning();
      setMessage("Looking up ticket…");
      setTicket(null);
      const result = await lookupTicket(eventId, value);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setTicket(result.ticket);
      setMessage("");
    },
    [eventId, stopScanning]
  );

  async function startScanning() {
    if (!window.BarcodeDetector) return;
    setMessage("");
    setTicket(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      setScanning(true);
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            handleScanValue(codes[0].rawValue);
          }
        } catch {
          // transient decode error on a mid-motion frame — ignore, next tick retries
        }
      }, 400);
    } catch (err) {
      console.error("Camera access failed", err);
      setMessage("Could not access the camera — check permissions, or use manual entry below.");
    }
  }

  useEffect(() => stopScanning, [stopScanning]);

  async function submitManualToken(e: React.FormEvent) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    await handleScanValue(manualToken.trim());
    setManualToken("");
  }

  async function commitCheckin() {
    if (!ticket) return;
    setConfirming(true);
    const result = await confirmCheckin(ticket.id);
    setConfirming(false);
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    setTicket({ ...ticket, checked_in_count: result.checkedInCount });
    setMessage("Checked in ✓");
  }

  if (authorized === null) return <p className="text-center py-20 text-ink/50">Loading…</p>;
  if (!authorized) {
    return (
      <p className="text-center py-20 text-ink/50">
        {role ? "Only organizers and head judges can access gate check-in." : "Please sign in."}
      </p>
    );
  }

  const remaining = ticket ? Math.max(0, ticket.quantity - ticket.checked_in_count) : 0;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-center">Gate check-in</h1>

      {cameraSupported ? (
        <div className="space-y-3">
          {scanning ? (
            <>
              <video ref={videoRef} muted playsInline className="w-full rounded-xl bg-black aspect-square object-cover" />
              <button
                type="button"
                onClick={stopScanning}
                className="w-full bg-ink/10 text-ink rounded-lg py-2.5 text-sm font-semibold"
              >
                Stop camera
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startScanning}
              className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold"
            >
              Start scanning
            </button>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          Camera scanning isn&apos;t supported in this browser (BarcodeDetector requires Chrome/Android — no
          Safari/iOS support yet). Use manual entry below instead.
        </p>
      )}

      <form onSubmit={submitManualToken} className="flex gap-2">
        <input
          type="text"
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          placeholder="Or paste/type the ticket code"
          className="flex-1 bg-white border border-ink/10 rounded-lg px-4 py-2.5 text-sm"
        />
        <button type="submit" className="bg-ink/10 text-ink rounded-lg px-4 py-2.5 text-sm font-semibold">
          Look up
        </button>
      </form>

      {message && !ticket && (
        <p className="text-center text-sm bg-amber-50 text-amber-700 rounded-lg px-3 py-2">{message}</p>
      )}

      {ticket && (
        <div className="bg-white border border-ink/10 rounded-xl p-5 space-y-3 animate-settle-in">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink/50">
              {ticket.ticket_type === "vendor" ? "Vendor pass" : "Spectator pass"}
            </p>
            <p className="text-lg font-semibold">{ticket.buyer_name}</p>
            <p className="text-ink/60 text-sm">
              ×{ticket.quantity} — {ticket.checked_in_count}/{ticket.quantity} checked in
            </p>
          </div>

          {remaining === 0 ? (
            <p className="text-center text-red-700 bg-red-50 rounded-lg px-3 py-2 text-sm font-semibold">
              Already fully used — {ticket.quantity}/{ticket.quantity} checked in.
            </p>
          ) : (
            <button
              type="button"
              onClick={commitCheckin}
              disabled={confirming}
              className="w-full bg-accent text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
            >
              {confirming ? "Confirming…" : `Confirm check-in (${remaining} left after this)`}
            </button>
          )}

          {message && <p className="text-center text-sm text-emerald-700">{message}</p>}

          <button
            type="button"
            onClick={() => {
              setTicket(null);
              setMessage("");
            }}
            className="w-full text-ink/60 text-xs"
          >
            Scan next ticket
          </button>
        </div>
      )}
    </div>
  );
}
