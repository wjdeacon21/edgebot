"use client";

import { useEffect, useState } from "react";
import { EmailQuery } from "@/types";

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ReviewDraftsPage() {
  const [drafts, setDrafts] = useState<EmailQuery[]>([]);
  const [editedReplies, setEditedReplies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [gmailLoading, setGmailLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [intentOverrides, setIntentOverrides] = useState<Record<string, string>>({});
  const [ticketStatusOverrides, setTicketStatusOverrides] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchDrafts() {
      try {
        const res = await fetch("/api/review-drafts");
        if (!res.ok) throw new Error("Failed to fetch");
        const data: EmailQuery[] = await res.json();
        setDrafts(data);
        // Pre-populate editable replies and intent overrides
        const replies: Record<string, string> = {};
        const intents: Record<string, string> = {};
        const tickets: Record<string, string> = {};
        data.forEach((d) => {
          replies[d.id] = d.suggested_reply || "";
          if (d.intent_category) intents[d.id] = d.intent_category;
          if (d.ticket_status) tickets[d.id] = d.ticket_status;
        });
        setEditedReplies(replies);
        setIntentOverrides(intents);
        setTicketStatusOverrides(tickets);
      } catch {
        // silently fail — empty state handles it
      } finally {
        setLoading(false);
      }
    }
    fetchDrafts();
  }, []);

  async function handleOpenInGmail(draft: EmailQuery) {
    const reply = editedReplies[draft.id] || "";
    if (!reply.trim() || gmailLoading[draft.id]) return;

    setGmailLoading((prev) => ({ ...prev, [draft.id]: true }));
    setErrors((prev) => ({ ...prev, [draft.id]: "" }));

    try {
      const res = await fetch("/api/gmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply, subject: draft.subject }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          [draft.id]: data.error || "Failed to create Gmail draft",
        }));
        return;
      }

      window.open("https://mail.google.com/mail/#drafts", "_blank");
    } catch {
      setErrors((prev) => ({
        ...prev,
        [draft.id]: "Failed to connect to Gmail. Please try again.",
      }));
    } finally {
      setGmailLoading((prev) => ({ ...prev, [draft.id]: false }));
    }
  }

  async function handleRegenerate(draft: EmailQuery) {
    if (regenerating[draft.id]) return;

    setRegenerating((prev) => ({ ...prev, [draft.id]: true }));
    setErrors((prev) => ({ ...prev, [draft.id]: "" }));

    try {
      const res = await fetch(`/api/email-queries/${draft.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent_category: intentOverrides[draft.id],
          ticket_status: ticketStatusOverrides[draft.id],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          [draft.id]: data.error || "Failed to regenerate draft",
        }));
        return;
      }

      setEditedReplies((prev) => ({ ...prev, [draft.id]: data.suggestedReply }));
    } catch {
      setErrors((prev) => ({
        ...prev,
        [draft.id]: "Failed to regenerate. Please try again.",
      }));
    } finally {
      setRegenerating((prev) => ({ ...prev, [draft.id]: false }));
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 p-4 pt-14 lg:p-8">
      <h1 className="text-2xl font-semibold text-[#0e103a] font-machina">Review Drafts</h1>
      <p className="mt-1 text-sm text-gray-500">
        Auto-generated replies from forwarded participant emails
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {/* Loading skeleton */}
        {loading && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6">
                <div className="mb-3 flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-48 rounded bg-gray-100" />
                    <div className="h-3 w-32 rounded bg-gray-100" />
                  </div>
                  <div className="h-3 w-16 rounded bg-gray-100" />
                </div>
                <div className="mb-4 h-3 w-full rounded bg-gray-100" />
                <div className="h-32 w-full rounded-xl bg-gray-100" />
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {!loading && drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-8 py-16 text-center">
            <span className="text-4xl">📬</span>
            <p className="mt-4 text-sm font-medium text-[#0e103a]">No forwarded emails yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Forward a participant email to your Postmark inbound address to get started.
            </p>
          </div>
        )}

        {/* Draft cards */}
        {!loading &&
          drafts.map((draft) => (
            <div key={draft.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6">
              {/* Card header */}
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-[#0e103a]">{draft.subject || "(No subject)"}</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">From</span>
                    <p className="text-xs text-gray-500">{draft.from_address || "Unknown sender"}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-gray-400">{timeAgo(draft.created_at)}</span>
              </div>

              {/* Email snippet */}
              <div className="mb-4 flex items-start gap-2">
                <div className="mt-0.5 flex shrink-0 items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Message</span>
                  {draft.raw_email.split('\n')[0].trim() !== draft.raw_email.trim() && (
                    <button
                      onClick={() => setExpandedMessages((prev) => ({ ...prev, [draft.id]: !prev[draft.id] }))}
                      className="text-sm font-bold text-gray-400 hover:text-gray-600 cursor-pointer leading-none"
                    >
                      {expandedMessages[draft.id] ? "×" : "+"}
                    </button>
                  )}
                </div>
                <div className="w-0 flex-1 overflow-hidden">
                  <p className="whitespace-pre-wrap break-all text-xs text-gray-500">
                    {expandedMessages[draft.id] ? draft.raw_email : draft.raw_email.split('\n')[0].trim() + (draft.raw_email.split('\n')[0].trim() !== draft.raw_email.trim() ? "…" : "")}
                  </p>
                </div>
              </div>

              {/* Intent selector */}
              <div className="mb-4 flex items-center gap-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Intent</span>
                <div className="flex flex-wrap gap-1.5">
                  {(["info", "action", "offer", "feedback"] as const).map((intent) => {
                    const active = intentOverrides[draft.id] === intent;
                    return (
                      <button
                        key={intent}
                        onClick={() =>
                          setIntentOverrides((prev) => ({ ...prev, [draft.id]: intent }))
                        }
                        className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors cursor-pointer ${
                          active
                            ? "bg-[#0e103a] text-white"
                            : "border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
                        }`}
                      >
                        {intent}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ticket status selector */}
              <div className="mb-4 flex items-center gap-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Ticket</span>
                <div className="flex flex-wrap gap-1.5">
                  {(["purchased", "not_purchased", "unknown"] as const).map((status) => {
                    const active = ticketStatusOverrides[draft.id] === status;
                    const label = status === "not_purchased" ? "Not purchased" : status.charAt(0).toUpperCase() + status.slice(1);
                    return (
                      <button
                        key={status}
                        onClick={() =>
                          setTicketStatusOverrides((prev) => ({ ...prev, [draft.id]: status }))
                        }
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? "bg-[#0e103a] text-white"
                            : "border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable reply */}
              <div className="mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Reply</span>
              </div>
              <textarea
                value={editedReplies[draft.id] ?? ""}
                onChange={(e) =>
                  setEditedReplies((prev) => ({ ...prev, [draft.id]: e.target.value }))
                }
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#0e103a] focus:border-gray-300 focus:outline-none"
                rows={6}
              />

              {/* Error */}
              {errors[draft.id] && (
                <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {errors[draft.id]}
                </div>
              )}

              {/* Action row */}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => handleRegenerate(draft)}
                  disabled={regenerating[draft.id]}
                  className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-800 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  {regenerating[draft.id] ? "Regenerating…" : "Regenerate reply"}
                </button>
                <button
                  onClick={() => handleOpenInGmail(draft)}
                  disabled={gmailLoading[draft.id] || !editedReplies[draft.id]?.trim()}
                  className="rounded-full bg-[#0e103a] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a0c2e] disabled:opacity-50 cursor-pointer"
                >
                  {gmailLoading[draft.id] ? "Sending…" : "Open in Gmail"}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
