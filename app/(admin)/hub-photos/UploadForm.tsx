"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addHubPhoto, addHubPhotosBulk, type BulkPhotoResult } from "./actions";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
// How many files to upload to Storage at once. The photographer's
// zip is ~1.2 GB; serial would crawl, unbounded would saturate the
// browser and Storage. Four at a time is a safe middle ground.
const UPLOAD_CONCURRENCY = 4;

type BatchStatus =
  | { phase: "idle" }
  | { phase: "running"; done: number; total: number; skippedDupe: number }
  | { phase: "done"; result: BulkPhotoResult & { clientDuplicates: number; oversized: number; nonImage: number } };

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function UploadForm({
  organizationId,
  events,
  historicalEvents,
}: {
  organizationId: string;
  events: { id: string; name: string }[];
  historicalEvents: { id: string; name: string }[];
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [batch, setBatch] = useState<BatchStatus>({ phase: "idle" });
  const [batchTaggedEvent, setBatchTaggedEvent] = useState("");

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

  async function handleBatchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const seenHashes = new Set<string>();
    let clientDuplicates = 0;
    let oversized = 0;
    let nonImage = 0;

    type Prepared = { file: File; hash: string };
    const prepared: Prepared[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        nonImage += 1;
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        oversized += 1;
        continue;
      }
      const hash = await sha256Hex(file);
      if (seenHashes.has(hash)) {
        clientDuplicates += 1;
        continue;
      }
      seenHashes.add(hash);
      prepared.push({ file, hash });
    }

    if (prepared.length === 0) {
      setBatch({
        phase: "done",
        result: {
          inserted: 0,
          duplicates: 0,
          failed: [],
          clientDuplicates,
          oversized,
          nonImage,
        },
      });
      return;
    }

    setBatch({ phase: "running", done: 0, total: prepared.length, skippedDupe: clientDuplicates });

    const supabase = createClient();
    const uploaded: { imageUrl: string; contentHash: string; caption: string }[] = [];
    const failed: { imageUrl: string; message: string }[] = [];

    let cursor = 0;
    async function worker() {
      while (cursor < prepared.length) {
        const index = cursor++;
        const { file, hash } = prepared[index];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${organizationId}/hub-${Date.now()}-${hash.slice(0, 12)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("hub-photos").upload(path, file);
        if (upErr) {
          failed.push({ imageUrl: file.name, message: upErr.message });
        } else {
          const { data } = supabase.storage.from("hub-photos").getPublicUrl(path);
          uploaded.push({ imageUrl: data.publicUrl, contentHash: hash, caption: "" });
        }
        setBatch((prev) =>
          prev.phase === "running" ? { ...prev, done: prev.done + 1 } : prev
        );
      }
    }

    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, prepared.length) }, worker));

    const dbResult = uploaded.length > 0
      ? await addHubPhotosBulk(batchTaggedEvent, uploaded)
      : { inserted: 0, duplicates: 0, failed: [] as { imageUrl: string; message: string }[] };

    setBatch({
      phase: "done",
      result: {
        inserted: dbResult.inserted,
        duplicates: dbResult.duplicates,
        failed: [...failed, ...dbResult.failed],
        clientDuplicates,
        oversized,
        nonImage,
      },
    });
  }

  return (
    <div className="space-y-6">
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
          {/* Encodes which FK column this tags — event_id vs
              historical_event_id — since they're two different tables
              (live Wodflow events vs pre-Wodflow "Past Rumbles" events)
              and a photo can only belong to one. Parsed in addHubPhoto. */}
          <select
            name="taggedEvent"
            defaultValue=""
            className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          >
            <option value="">None — homepage carousel only</option>
            {events.length > 0 && (
              <optgroup label="Live events">
                {events.map((e) => (
                  <option key={e.id} value={`event:${e.id}`}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            )}
            {historicalEvents.length > 0 && (
              <optgroup label="Past Rumbles (historical)">
                {historicalEvents.map((e) => (
                  <option key={e.id} value={`historical:${e.id}`}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            )}
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

      <div className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Bulk upload</h2>
          <p className="text-ink/60 text-xs mt-1">
            Pick many photos at once. Byte-identical duplicates (same file re-added
            later, or repeats inside the same batch) are skipped automatically.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
            Tag the whole batch to (optional)
          </label>
          <select
            value={batchTaggedEvent}
            onChange={(e) => setBatchTaggedEvent(e.target.value)}
            className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          >
            <option value="">None — homepage carousel only</option>
            {events.length > 0 && (
              <optgroup label="Live events">
                {events.map((e) => (
                  <option key={e.id} value={`event:${e.id}`}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            )}
            {historicalEvents.length > 0 && (
              <optgroup label="Past Rumbles (historical)">
                {historicalEvents.map((e) => (
                  <option key={e.id} value={`historical:${e.id}`}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Photos</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleBatchChange}
            disabled={batch.phase === "running"}
            className="text-sm"
          />
        </div>

        {batch.phase === "running" && (
          <p className="text-ink/60 text-xs">
            Uploading {batch.done}/{batch.total}… keep this tab open.
            {batch.skippedDupe > 0 && ` ${batch.skippedDupe} duplicate${batch.skippedDupe === 1 ? "" : "s"} in the batch skipped.`}
          </p>
        )}

        {batch.phase === "done" && (
          <div className="text-sm space-y-1">
            <p className="font-semibold text-ink">
              Added {batch.result.inserted} photo{batch.result.inserted === 1 ? "" : "s"}.
            </p>
            {batch.result.duplicates > 0 && (
              <p className="text-ink/70 text-xs">
                Skipped {batch.result.duplicates} duplicate{batch.result.duplicates === 1 ? "" : "s"} already in the hub.
              </p>
            )}
            {batch.result.clientDuplicates > 0 && (
              <p className="text-ink/70 text-xs">
                Skipped {batch.result.clientDuplicates} duplicate{batch.result.clientDuplicates === 1 ? "" : "s"} inside the batch itself.
              </p>
            )}
            {batch.result.oversized > 0 && (
              <p className="text-ink/70 text-xs">
                Skipped {batch.result.oversized} file{batch.result.oversized === 1 ? "" : "s"} over 8 MB.
              </p>
            )}
            {batch.result.nonImage > 0 && (
              <p className="text-ink/70 text-xs">
                Skipped {batch.result.nonImage} non-image file{batch.result.nonImage === 1 ? "" : "s"}.
              </p>
            )}
            {batch.result.failed.length > 0 && (
              <details className="text-xs text-red-700 mt-2">
                <summary className="cursor-pointer">
                  {batch.result.failed.length} failed — show details
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {batch.result.failed.slice(0, 20).map((f, i) => (
                    <li key={i} className="truncate">{f.imageUrl} — {f.message}</li>
                  ))}
                  {batch.result.failed.length > 20 && (
                    <li>…and {batch.result.failed.length - 20} more</li>
                  )}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
