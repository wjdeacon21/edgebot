"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface GenerateResult {
  id: string;
  suggestedReply: string;
  confidence: string;
  conflictFlag: boolean;
  conflicts: string[];
  sourcesUsed: {
    source_id: string;
    source_type: string;
    page_number: number | null;
    snippet: string;
  }[];
}

export default function DrafterPage() {
  const [rawEmail, setRawEmail] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [editedReply, setEditedReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  async function handleGenerate() {
    if (!rawEmail.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      setResult(data);
      setEditedReply(data.suggestedReply);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!result?.id) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const res = await fetch(`/api/email-queries/${result.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "approved",
        approved_version: editedReply,
        approved_by: user?.id || null,
      }),
    });

    if (res.ok) {
      setRawEmail("");
      setResult(null);
      setEditedReply("");
    }
  }

  async function handleEscalate() {
    if (!result?.id) return;

    const res = await fetch(`/api/email-queries/${result.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "escalated" }),
    });

    if (res.ok) {
      setActionFeedback("Escalated for review.");
      setTimeout(() => {
        setRawEmail("");
        setResult(null);
        setEditedReply("");
        setActionFeedback(null);
      }, 2000);
    }
  }

  // Right pill styling based on state
  const canGenerate = rawEmail.trim() && !loading && !result;
  const rightPillClass = (() => {
    if (loading) {
      return "bg-purple-600 text-white opacity-75 cursor-wait";
    }
    if (result) {
      return "bg-white border border-gray-200 text-gray-700 cursor-default";
    }
    if (rawEmail.trim()) {
      return "bg-purple-600 text-white hover:bg-purple-700 cursor-pointer shadow-md shadow-purple-200";
    }
    return "bg-white border border-gray-200 text-gray-400 cursor-default";
  })();

  // Shimmer on input card when empty and not focused
  const showInputShimmer = !rawEmail.trim() && !inputFocused;

  // Left panel goes grayscale once a draft exists (or is loading)
  const leftPanelDimmed = loading || !!result;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Drafter</h1>
      <p className="mt-1 text-sm text-gray-500">
        Respond to FAQs from Edge Participants
      </p>

      <div className="mt-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column — Input */}
        <div className={`flex flex-col gap-4 transition-all duration-500 ${leftPanelDimmed ? "opacity-50 grayscale" : ""}`}>
          <div className={`rounded-full px-6 py-3 text-center text-base font-bold transition-colors ${leftPanelDimmed ? "border border-gray-200 bg-white text-gray-400" : "bg-purple-600 text-white"}`}>
            Bring in an email or question below
          </div>
          <div className={`flex-1 rounded-2xl p-[2px] ${showInputShimmer ? "purple-shimmer" : "bg-gray-200"}`}>
            <div className="h-full rounded-2xl bg-white p-1">
              <textarea
                value={rawEmail}
                onChange={(e) => setRawEmail(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Paste a participant email or question..."
                className="h-full min-h-[400px] w-full resize-none rounded-2xl border-0 bg-transparent px-5 py-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
              />
            </div>
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Right Column — Draft */}
        <div className="flex flex-col gap-4">
          <button
            onClick={canGenerate ? handleGenerate : undefined}
            className={`w-full rounded-full px-6 py-3 text-center text-base font-bold transition-colors ${rightPillClass}`}
          >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Drafting...
                </span>
              ) : (
                result ? "Your draft" : "Click to draft a response"
              )}
          </button>

          <div className="flex-1 rounded-2xl border border-gray-200 bg-white p-1">
            {/* Loading skeleton */}
            {loading && (
              <div className="animate-pulse space-y-4 px-5 py-4">
                <div className="h-3 w-3/4 rounded bg-gray-100" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-5/6 rounded bg-gray-100" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-2/3 rounded bg-gray-100" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-4/5 rounded bg-gray-100" />
              </div>
            )}

            {/* Empty state */}
            {!loading && !result && (
              <div className="flex h-full min-h-[400px] items-center justify-center">
                <p className="text-sm text-gray-300">
                  Your draft will appear here
                </p>
              </div>
            )}

            {/* Draft text */}
            {!loading && result && (
              <textarea
                value={editedReply}
                onChange={(e) => setEditedReply(e.target.value)}
                className="h-full min-h-[400px] w-full resize-none rounded-2xl border-0 bg-transparent px-5 py-4 text-sm text-gray-900 focus:outline-none"
              />
            )}
          </div>

          {/* Action buttons + feedback */}
          {result && (
            <div>
              <div className="rounded-full p-[2px] purple-shimmer">
                <div className="flex rounded-full bg-white p-1">
                  <button
                    onClick={handleApprove}
                    className="flex-1 rounded-full bg-gray-900 py-2.5 text-center text-sm font-medium text-white hover:bg-gray-800 cursor-pointer"
                  >
                    New draft
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex-1 rounded-full py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
