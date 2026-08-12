"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addHubPhoto } from "./actions";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function UploadForm({
  organizationId,
  events,
}: {
  organizationId: string;
  events: { id: string; name: string }[];
}) {
  const [imageUrl, setImageUrl] = useState("");
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
      setError("Image is too large — please choose one under 8MB.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${organizationId}/hub-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("hub-photos").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from("hub-photos").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={addHubPhoto} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
      <h2 className="font-semibold">Add a photo</h2>
      <input type="hidden" name="imageUrl" value={imageUrl} />

      {imageUrl && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-32 rounded-lg border border-ink/10 object-cover" />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Photo</label>
        <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="text-sm" />
        {uploading && <p className="text-ink/50 text-xs mt-1">Uploading…</p>}
        {error && <p className="text-red-700 text-xs mt-1">{error}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Caption (optional)</label>
        <input
          name="caption"
          placeholder="Podium, RX Male division"
          className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Event (optional)</label>
        <select
          name="eventId"
          defaultValue=""
          className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
        >
          <option value="">None — homepage carousel only</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={uploading || !imageUrl}
        className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
      >
        Add to carousel
      </button>
    </form>
  );
}
