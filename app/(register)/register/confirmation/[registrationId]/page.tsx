"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BrandKitLogo } from "@/components/BrandKitLogo";
import { brandKitStyle, type BrandKit } from "@/lib/brandKit";

type TeamInvite = { token: string; email_or_phone: string; status: string };

type DivisionWithEvent = {
  name: string;
  events: { brand_kits: BrandKit | BrandKit[] | null } | { brand_kits: BrandKit | BrandKit[] | null }[] | null;
};

type Registration = {
  id: string;
  payment_status: string;
  team_name: string | null;
  price_paid: number;
  divisions: DivisionWithEvent | DivisionWithEvent[] | null;
  team_invites: TeamInvite[] | null;
};

function extractBrandKit(division: DivisionWithEvent | null | undefined): BrandKit | null {
  const event = Array.isArray(division?.events) ? division?.events[0] : division?.events;
  const kit = Array.isArray(event?.brand_kits) ? event?.brand_kits[0] : event?.brand_kits;
  return kit ?? null;
}

export default function ConfirmationPage() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const res = await fetch(`/api/registrations/${registrationId}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (data.registration) {
        setRegistration(data.registration);
        setLoading(false);
        // Yoco's webhook can land a few seconds after redirect — keep
        // polling gently until we see it, rather than telling the athlete
        // their payment "failed" when it's just still confirming.
        if (data.registration.payment_status === "pending") {
          setTimeout(poll, 3000);
        }
      }
    }
    poll();

    return () => {
      cancelled = true;
    };
  }, [registrationId]);

  const division = Array.isArray(registration?.divisions)
    ? registration?.divisions[0]
    : registration?.divisions;
  const divisionName = division?.name;
  const brandKit = extractBrandKit(division);

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4" style={brandKitStyle(brandKit)}>
      {brandKit?.logo_url && <BrandKitLogo kit={brandKit} className="h-12 mx-auto mb-3" />}
      {loading ? (
        <p className="text-ink/50">Checking your registration…</p>
      ) : !registration ? (
        <p className="text-red-700">Registration not found.</p>
      ) : registration.payment_status === "paid" ? (
        <>
          <h1 className="text-2xl font-semibold">You&apos;re in! 🎉</h1>
          <p className="text-ink/70">
            {registration.team_name ? `${registration.team_name} — ` : ""}
            {divisionName} · R{registration.price_paid} paid
          </p>
          <p className="text-ink/50 text-sm">
            Your heat time and lane will be published closer to the event.
          </p>
          {registration.team_invites && registration.team_invites.length > 0 && (
            <div className="text-left bg-white border border-ink/10 rounded-xl p-4 space-y-3 mt-6">
              <h2 className="font-semibold text-sm">Send your teammates their sign-up link</h2>
              <p className="text-ink/60 text-xs">
                Each teammate should sign in or create their own account and confirm their own
                details and waiver.
              </p>
              {registration.team_invites.map((inv) => (
                <div key={inv.token} className="text-xs bg-paper rounded-lg px-3 py-2 break-all">
                  <p className="text-ink/50 mb-1">{inv.email_or_phone}</p>
                  <p className="font-data">
                    {typeof window !== "undefined" ? window.location.origin : ""}/invite/{inv.token}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Confirming your payment…</h1>
          <p className="text-ink/60 text-sm">This usually takes a few seconds.</p>
        </>
      )}
    </div>
  );
}
