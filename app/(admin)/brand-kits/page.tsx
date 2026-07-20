import { createClient } from "@/lib/supabase/server";
import { createBrandKit, deleteBrandKit } from "./actions";

export default async function BrandKitsPage() {
  const supabase = await createClient();
  const { data: kits } = await supabase
    .from("brand_kits")
    .select("id, name, logo_url, color_primary, color_secondary, color_accent, tagline")
    .order("name");

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Brand kits</h1>
        <p className="text-ink/60 text-sm mt-1">
          Create once, assign to any event — reused year over year (e.g. Rumble Indy, Rumble Remix).
        </p>
      </div>

      <div className="space-y-3">
        {(kits ?? []).map((k) => (
          <div
            key={k.id}
            className="bg-white border border-ink/10 rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[k.color_primary, k.color_secondary, k.color_accent].filter(Boolean).map((c, i) => (
                  <span
                    key={i}
                    className="w-5 h-5 rounded-full border border-ink/10"
                    style={{ background: c ?? undefined }}
                  />
                ))}
              </div>
              <div>
                <p className="font-semibold">{k.name}</p>
                {k.tagline && <p className="text-ink/60 text-sm">{k.tagline}</p>}
              </div>
            </div>
            <form action={deleteBrandKit}>
              <input type="hidden" name="id" value={k.id} />
              <button type="submit" className="text-sm text-ink/40 hover:text-ink/70">
                Delete
              </button>
            </form>
          </div>
        ))}
        {(!kits || kits.length === 0) && (
          <p className="text-ink/60 text-sm">No brand kits yet — create one below.</p>
        )}
      </div>

      <form action={createBrandKit} className="bg-white border border-ink/10 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">New brand kit</h2>
        <Field label="Name" name="name" required placeholder="Rumble Indy" />
        <Field label="Logo URL" name="logoUrl" placeholder="https://..." />
        <Field label="Tagline" name="tagline" placeholder="Yeeeah! Get Some!" />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Primary color" name="colorPrimary" placeholder="#ED1C24" />
          <Field label="Secondary color" name="colorSecondary" placeholder="#F9A01B" />
          <Field label="Accent color" name="colorAccent" placeholder="#1C75BC" />
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Create brand kit
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2">{label}</label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
      />
    </div>
  );
}
