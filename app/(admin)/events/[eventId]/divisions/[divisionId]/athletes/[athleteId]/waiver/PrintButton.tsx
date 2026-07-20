"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-semibold"
    >
      Print / Save as PDF
    </button>
  );
}
