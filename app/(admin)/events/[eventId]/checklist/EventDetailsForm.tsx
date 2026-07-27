"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateEventDetails } from "./actions";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function EventDetailsForm({
  eventId,
  initialDescription,
  initialPosterUrl,
}: {
  eventId: string;
  initialDescription: string;
  initialPosterUrl: string;
}) {
  const [posterUrl, setPosterUrl] = useState(initialPosterUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image is too large — please choose one under 5MB.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      // Timestamped filename so a replaced poster gets a fresh URL —
      // avoids athletes' browsers showing a stale cached image after
      // the organizer swaps the poster.
      const path = `${eventId}/poster-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("event-posters").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from("event-posters").getPublicUrl(path);
      setPosterUrl(data.publicUrl);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      action={updateEventDetails}
      className="bg-white border border-ink/10 rounded-xl p-4 space-y-3"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="posterUrl" value={posterUrl} />
      <h2 className="font-semibold text-sm uppercase tracking-wider text-ink/50">
        Event description &amp; poster
      </h2>
      <p className="text-ink/60 text-xs">
        Shown on the homepage listing, the registration page, and the confirmation page.
      </p>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
          Poster image
        </label>
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt="Event poster"
            className="w-full max-w-xs aspect-video object-cover rounded-lg border border-ink/10 mb-2"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="text-sm"
        />
        {uploading && <p className="text-ink/50 text-xs mt-1">Uploading…</p>}
        {error && <p className="text-red-700 text-xs mt-1">{error}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
          Description
        </label>
        <textarea
          name="description"
          rows={4}
          defaultValue={initialDescription}
          placeholder="What's this event about? Format, vibe, what to expect…"
          className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
        />
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
      >
        Save
      </button>
    </form>
  );
}
