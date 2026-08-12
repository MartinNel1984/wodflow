"use client";

import { useActionState } from "react";
import { addNotice } from "./actions";

export default function NoticeForm({ eventId }: { eventId: string }) {
  const [state, formAction] = useActionState(addNotice, { error: null });

  return (
    <form action={formAction} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <h2 className="font-semibold">Post a notice</h2>
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
      )}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Title</label>
        <input
          type="text"
          name="title"
          required
          placeholder="Briefing time change"
          className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Message</label>
        <textarea
          name="body"
          rows={4}
          required
          className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
        />
      </div>
      <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
        Post notice
      </button>
    </form>
  );
}
