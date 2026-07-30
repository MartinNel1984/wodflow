import { requireOrganizer } from "@/lib/auth";
import { deleteHubPhoto } from "./actions";
import { UploadForm } from "./UploadForm";

export default async function HubPhotosPage() {
  const { supabase, organizationId } = await requireOrganizer();
  const { data: photos } = await supabase
    .from("hub_photos")
    .select("id, image_url, caption, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Rumble hub photos</h1>
        <p className="text-ink/60 text-sm mt-1">
          The "From the Floor" carousel on wodflow.co.za. Added in order — newest goes last.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(photos ?? []).map((p) => (
          <div key={p.id} className="bg-white border border-ink/10 rounded-xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt={p.caption ?? ""} className="w-full aspect-square object-cover" />
            <div className="p-2 flex items-center justify-between gap-2">
              <p className="text-xs text-ink/60 truncate">{p.caption || "—"}</p>
              <form action={deleteHubPhoto}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="text-xs text-ink/40 hover:text-red-700 shrink-0">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
        {(!photos || photos.length === 0) && (
          <p className="text-ink/60 text-sm col-span-full">No photos yet — add one below.</p>
        )}
      </div>

      <UploadForm organizationId={organizationId} />
    </div>
  );
}
