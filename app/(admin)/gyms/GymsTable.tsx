"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type GymRow = {
  id: string;
  name: string;
  approved: boolean;
  createdAt: string;
  athleteCount: number;
};

export default function GymsTable({ rows }: { rows: GymRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  const pending = useMemo(() => rows.filter((r) => !r.approved), [rows]);
  const approved = useMemo(() => rows.filter((r) => r.approved), [rows]);

  const q = query.trim().toLowerCase();
  const matches = (r: GymRow) => !q || r.name.toLowerCase().includes(q);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError("");
    const res = await fetch("/api/gyms/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(json?.error ?? "Update failed.");
      return false;
    }
    setEditing(null);
    router.refresh();
    return true;
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Athletes on this gym will fall back to blank.`)) return;
    setBusy(id);
    setError("");
    const res = await fetch(`/api/gyms/admin?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(json?.error ?? "Delete failed.");
      return;
    }
    router.refresh();
  }

  function startEdit(r: GymRow) {
    setEditing(r.id);
    setEditName(r.name);
    setError("");
  }

  return (
    <div className="space-y-6">
      <input
        type="text"
        placeholder="Search gyms…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-white border border-ink/10 rounded-lg px-4 py-3 text-sm"
      />
      {error && <p className="text-red-700 text-sm">{error}</p>}

      <section className="space-y-2">
        <h2 className="font-semibold">
          Pending <span className="text-ink/40 text-sm font-normal">({pending.length})</span>
        </h2>
        <p className="text-ink/60 text-xs">
          Added by athletes during signup. Rename to the canonical spelling and approve, or delete.
        </p>
        <div className="bg-white border border-ink/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink/5 text-left">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2 whitespace-nowrap">Athletes</th>
                <th className="px-4 py-2 whitespace-nowrap">Added</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {pending.filter(matches).map((r) => (
                <GymTableRow
                  key={r.id}
                  r={r}
                  editing={editing === r.id}
                  editName={editName}
                  setEditName={setEditName}
                  busy={busy === r.id}
                  onEdit={() => startEdit(r)}
                  onCancel={() => setEditing(null)}
                  onSaveName={() => patch(r.id, { name: editName.trim(), approved: true })}
                  onApprove={() => patch(r.id, { approved: true })}
                  onDelete={() => remove(r.id, r.name)}
                  showApprove
                />
              ))}
              {pending.filter(matches).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink/60 text-sm">
                    Nothing pending.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">
          Approved <span className="text-ink/40 text-sm font-normal">({approved.length})</span>
        </h2>
        <div className="bg-white border border-ink/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink/5 text-left">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2 whitespace-nowrap">Athletes</th>
                <th className="px-4 py-2 whitespace-nowrap">Added</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {approved.filter(matches).map((r) => (
                <GymTableRow
                  key={r.id}
                  r={r}
                  editing={editing === r.id}
                  editName={editName}
                  setEditName={setEditName}
                  busy={busy === r.id}
                  onEdit={() => startEdit(r)}
                  onCancel={() => setEditing(null)}
                  onSaveName={() => patch(r.id, { name: editName.trim() })}
                  onDelete={() => remove(r.id, r.name)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function GymTableRow({
  r,
  editing,
  editName,
  setEditName,
  busy,
  onEdit,
  onCancel,
  onSaveName,
  onApprove,
  onDelete,
  showApprove,
}: {
  r: GymRow;
  editing: boolean;
  editName: string;
  setEditName: (v: string) => void;
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaveName: () => void;
  onApprove?: () => void;
  onDelete: () => void;
  showApprove?: boolean;
}) {
  return (
    <tr className="border-t border-ink/10 align-middle">
      <td className="px-4 py-2">
        {editing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-paper rounded-lg px-3 py-2 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        ) : (
          <span className="font-semibold">{r.name}</span>
        )}
      </td>
      <td className="px-4 py-2 text-ink/60 whitespace-nowrap">{r.athleteCount}</td>
      <td className="px-4 py-2 text-ink/50 whitespace-nowrap">{r.createdAt.slice(0, 10)}</td>
      <td className="px-4 py-2 text-right whitespace-nowrap space-x-3">
        {editing ? (
          <>
            <button
              type="button"
              disabled={busy || !editName.trim()}
              onClick={onSaveName}
              className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
            >
              {busy ? "Saving…" : showApprove ? "Save & approve" : "Save"}
            </button>
            <button type="button" onClick={onCancel} className="text-xs text-ink/50 hover:text-ink">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit} className="text-xs font-semibold text-accent hover:underline">
              Rename
            </button>
            {showApprove && onApprove && (
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="text-xs font-semibold text-green-700 hover:underline disabled:opacity-50"
              >
                Approve as-is
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="text-xs text-red-700 hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
