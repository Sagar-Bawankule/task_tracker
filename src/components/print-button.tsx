"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="text-xs text-brand-700 hover:underline">
      Print / PDF
    </button>
  );
}
