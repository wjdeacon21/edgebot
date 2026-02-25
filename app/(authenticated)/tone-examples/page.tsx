"use client";

import { useEffect, useState } from "react";
import { useUserRole } from "@/lib/useUserRole";

interface ToneExample {
  id: string;
  body: string;
  created_at: string;
}

export default function ToneExamplesPage() {
  const { isAdmin, role } = useUserRole();
  const [examples, setExamples] = useState<ToneExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (role === null) return;
    if (!isAdmin) return;

    fetch("/api/tone-examples")
      .then((r) => r.json())
      .then((data) => {
        setExamples(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [isAdmin, role]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/tone-examples/${id}`, { method: "DELETE" });
    setExamples((prev) => prev.filter((e) => e.id !== id));
    setDeletingId(null);
  }

  if (role === null) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-2xl font-semibold text-[#0e103a]">Access Denied</h1>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-semibold text-[#0e103a]">Tone Examples</h1>
      <p className="mt-1 text-sm text-gray-500">
        Reply examples stored for tone reference. Forward an email with subject{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">Tone: anything</code> to add one.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-gray-400">Loading...</p>
      ) : examples.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No tone examples yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {examples.map((example) => (
            <div
              key={example.id}
              className="flex items-start justify-between rounded-md border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-sm text-[#0e103a] leading-relaxed whitespace-pre-wrap">
                  {example.body}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(example.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(example.id)}
                disabled={deletingId === example.id}
                className="shrink-0 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {deletingId === example.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
