"use client";

import { useEffect, useRef, useState } from "react";

export type GymOption = { id: string; name: string };

// GymPicker — typeahead over the approved gyms list. If the typed value
// doesn't match an approved gym, the picker offers to add it as pending
// (organiser verifies in /gyms). The committed value — whether picked or
// freshly added — is a canonical gym name (string), surfaced via onChange.
//
// `required` is enforced via a hidden input so native form validation
// catches blanks, and the parent sees onChange("") until the user picks.
export function GymPicker({
  value,
  onChange,
  required,
  placeholder = "Start typing your gym…",
  // Admin picker: restricts to approved gyms only — hides the
  // "add new gym" affordance so admin picks from the canonical list.
  approvedOnly = false,
  name = "gymName",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  approvedOnly?: boolean;
  name?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  // Sanctioned "store info from previous renders" pattern — adopts the
  // new parent value immediately, so the admin table can reuse one
  // picker across different rows.
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }
  const [options, setOptions] = useState<GymOption[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gyms")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setOptions(Array.isArray(j?.gyms) ? j.gyms : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((g) => g.name.toLowerCase().includes(q))
    : options;
  const exact = options.find((g) => g.name.toLowerCase() === q);

  function pick(name: string) {
    setQuery(name);
    onChange(name);
    setOpen(false);
    setAddError("");
  }

  async function addPending() {
    const name = query.trim().replace(/\s+/g, " ");
    if (!name) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/gyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json?.error ?? "Couldn't add gym.");
        return;
      }
      // If the API returns an existing approved gym, prefer that spelling.
      pick(json.gym?.name ?? name);
      if (!options.find((g) => g.id === json.gym?.id) && json.gym?.approved) {
        setOptions((prev) =>
          [...prev, { id: json.gym.id, name: json.gym.name }].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setOpen(true);
          setAddError("");
        }}
        onFocus={() => setOpen(true)}
        className="w-full bg-paper rounded-lg px-3 py-2 text-sm border border-ink/10 focus:outline-none focus:border-accent"
      />
      {/* Hidden mirror so native `required` form validation works on the
          committed value (empty until the user actually picks). */}
      <input type="hidden" name={name} value={value} required={required} />

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-ink/15 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pick(g.name)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-ink/5"
            >
              {g.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-ink/60">No match for &ldquo;{query}&rdquo;.</p>
          )}
          {!approvedOnly && query.trim() && !exact && (
            <div className="border-t border-ink/10 px-3 py-2 space-y-1">
              <button
                type="button"
                onClick={addPending}
                disabled={adding}
                className="w-full text-left text-sm text-accent font-semibold hover:underline disabled:opacity-50"
              >
                {adding ? "Adding…" : `+ Add "${query.trim()}" as a new gym`}
              </button>
              <p className="text-[11px] text-ink/50">
                We&apos;ll flag it for the organiser to verify.
              </p>
              {addError && <p className="text-[11px] text-red-700">{addError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
