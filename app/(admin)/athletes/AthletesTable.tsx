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

export default function AthletesTable({ rows }: { rows: AthleteRow[] }) {
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
                <td className="px-4 py-2 text-right">
                  {r.waiverSignedAt && (
                    <Link href={r.waiverHref} className="text-accent text-xs font-semibold hover:underline">
                      View waiver
                    </Link>
                  )}
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
    </div>
  );
}
