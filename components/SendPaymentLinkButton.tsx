"use client";

import { useState, useTransition } from "react";

export function SendPaymentLinkButton({
  registrationId,
  action,
}: {
  registrationId: string;
  action: (formData: FormData) => Promise<{ sent: boolean }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "failed">("idle");

  if (status === "sent") {
    return <span className="text-green-700 text-xs font-semibold whitespace-nowrap">✓ Sent</span>;
  }

  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setStatus("idle");
          const formData = new FormData();
          formData.set("registrationId", registrationId);
          startTransition(async () => {
            const result = await action(formData);
            setStatus(result.sent ? "sent" : "failed");
          });
        }}
        className="text-accent text-xs font-semibold hover:underline disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send payment link"}
      </button>
      {status === "failed" && (
        <span className="text-red-700 text-xs font-semibold">Failed — try again</span>
      )}
    </div>
  );
}
