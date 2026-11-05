"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <h2 className="text-lg font-semibold text-stone-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-stone-500">{error.message || "Please try again."}</p>
      <button onClick={reset} className="btn-primary mt-4">Try again</button>
    </div>
  );
}
