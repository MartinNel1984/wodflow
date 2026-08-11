"use client";

import { useState, useTransition } from "react";

export function MarkPaidButton({
  registrationId,
  eventId,
  divisionId,
  action,
}: {
  registrationId: string;
  eventId: string;
  divisionId: string;
  action: (formData: FormData) => Promise<{ sent: boolean }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "failed">("idle");

  if (status === "sent") {
    return <span className="text-green-700 text-xs font-semibold whitespace-nowrap">✓ Paid & notified</span>;
  }

  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm("Confirm payment was actually received (e.g. in PayFast) before marking paid — this sends the athlete a confirmation email.")) {
            return;
          }
          setStatus("idle");
          const formData = new FormData();
          formData.set("registrationId", registrationId);
          formData.set("eventId", eventId);
          formData.set("divisionId", divisionId);
          startTransition(async () => {
            const result = await action(formData);
            setStatus(result.sent ? "sent" : "failed");
          });
        }}
        className="text-accent text-xs font-semibold hover:underline disabled:opacity-50"
      >
        {isPending ? "Marking paid…" : "Mark paid & notify"}
      </button>
      {status === "failed" && (
        <span className="text-red-700 text-xs font-semibold">Failed — try again</span>
      )}
    </div>
  );
}
