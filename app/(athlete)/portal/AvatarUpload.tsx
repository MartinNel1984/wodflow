"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function AvatarUpload({
  profileId,
  initialAvatarUrl,
  fullName,
}: {
  profileId: string;
  initialAvatarUrl: string | null;
  fullName: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const initial = fullName.trim().charAt(0).toUpperCase() || "?";

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
      // Fixed filename (not timestamped like the event poster upload) —
      // an athlete only ever has one current avatar, so overwriting in
      // place is correct here, not additive.
      const path = `${profileId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("athlete-avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from("athlete-avatars").getPublicUrl(path);
      // Cache-bust so the athlete's own browser shows the new photo
      // immediately instead of a cached previous upload at the same path.
      const freshUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: freshUrl })
        .eq("id", profileId);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setAvatarUrl(freshUrl);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <label className="relative cursor-pointer group">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={fullName}
            className="w-24 h-24 rounded-full object-cover border-2 border-ink"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-accent text-white border-2 border-ink flex items-center justify-center text-3xl font-bold">
            {initial}
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
          {uploading ? "Uploading…" : "Change"}
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      {error && <p className="text-red-700 text-xs">{error}</p>}
    </div>
  );
}
