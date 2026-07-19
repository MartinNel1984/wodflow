"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Registration = {
  id: string;
  payment_status: string;
  team_name: string | null;
  price_paid: number;
  divisions: { name: string } | { name: string }[] | null;
};

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

  const divisionName = Array.isArray(registration?.divisions)
    ? registration?.divisions[0]?.name
    : registration?.divisions?.name;

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
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
