"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type AthleteRow = {
  id: string;
  fullName: string;
  idNumber: string | null;
  isMinor: boolean;
  waiverSignedAt: string | null;
  paymentStatus: string;
  eventName: string;
  divisionName: string;
  waiverHref: string;
};

export default function AthletesTable({
  rows,
  divisions,
  addAthleteAction,
  removeAthleteAction,
}: {
  rows: AthleteRow[];
  divisions: { id: string; label: string }[];
  addAthleteAction: (formData: FormData) => void;
  removeAthleteAction: (formData: FormData) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.eventName.toLowerCase().includes(q) ||
        (r.idNumber ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, event, or ID number…"
        className="w-full bg-white border border-ink/10 rounded-lg px-4 py-3 text-sm"
      />
      <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink/5 text-left">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">ID number</th>
              <th className="px-4 py-2">Waiver</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-ink/10">
                <td className="px-4 py-2">
                  {r.fullName}
                  {r.isMinor && (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-accent">
                      Minor
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-ink/60">
                  {r.eventName} · {r.divisionName}
                </td>
                <td className="px-4 py-2 font-data">{r.idNumber || "—"}</td>
                <td className="px-4 py-2">
                  {r.waiverSignedAt ? (
                    <span className="text-green-700">✓ Signed</span>
                  ) : (
                    <span className="text-amber-700 font-semibold">Not signed</span>
                  )}
                </td>
                <td className="px-4 py-2 capitalize">{r.paymentStatus}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {r.waiverSignedAt && (
                    <Link href={r.waiverHref} className="text-accent text-xs font-semibold hover:underline mr-3">
                      View waiver
                    </Link>
                  )}
                  <form action={removeAthleteAction} className="inline">
                    <input type="hidden" name="athleteId" value={r.id} />
                    <button type="submit" className="text-xs text-ink/40 hover:text-ink/70">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/60 text-sm">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        action={addAthleteAction}
        className="bg-white border border-ink/10 rounded-xl p-6 space-y-4"
      >
        <h2 className="font-semibold">Add athlete manually</h2>
        <p className="text-ink/60 text-sm">
          For walk-up entries who didn&apos;t go through the public registration wizard. Marked as
          waived (no payment).
        </p>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Division</label>
          <select
            name="divisionId"
            required
            className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10"
          >
            <option value="">Select a division…</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Full name</label>
            <input
              type="text"
              name="fullName"
              required
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              Email (optional)
            </label>
            <input
              type="email"
              name="email"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
              ID number (optional)
            </label>
            <input
              type="text"
              name="idNumber"
              className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          Add athlete
        </button>
      </form>
    </div>
  );
}
