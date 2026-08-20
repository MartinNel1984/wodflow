"use client";

export function DeleteEventButton({ eventName }: { eventName: string }) {
  return (
    <button
      type="submit"
      className="text-red-600 text-xs hover:underline"
      onClick={(e) => {
        if (!confirm(`Delete "${eventName}"? This can't be undone.`)) e.preventDefault();
      }}
    >
      Delete test copy
    </button>
  );
}
