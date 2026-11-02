
"use client";

import { useState } from "react";

type Props = {
  projectId: number;
  onAdded: () => void;
};

export default function DemoDataButton({ projectId, onAdded }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function addDemoData() {
    setLoading(true);
    setMessage("");
    setError(false);

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const response = await fetch(
        `${baseUrl}/api/projects/${projectId}/demo-data`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error?.message || "Could not add demo data."
        );
      }

      setMessage("Demo project information added successfully.");
      onAdded();
    } catch (err) {
      setError(true);
      setMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={addDemoData}
        disabled={loading}
        className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Adding demo data..." : "✦ Load Demo Data"}
      </button>

      {message && (
        <p
          role="status"
          className={`text-sm ${
            error ? "text-red-600" : "text-green-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
