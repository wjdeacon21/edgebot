"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TipTapLink from "@tiptap/extension-link";
import { createClient } from "@/lib/supabase-browser";
import { EmailQuery } from "@/types";

function reflowEmail(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n/g, " "))
    .join("\n\n");
}

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

function markdownLinksToHtml(text: string): string {
  const withLinks = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  );
  return withLinks
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function DraftEditor({
  draftId,
  initialContent,
  onContentChange,
}: {
  draftId: string;
  initialContent: string;
  onContentChange: (id: string, html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TipTapLink.configure({
        openOnClick: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: initialContent,
    onUpdate({ editor }) {
      onContentChange(draftId, editor.getHTML());
    },
  });

  return (
    <EditorContent
      editor={editor}
      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#0e103a] focus-within:border-gray-300 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[7rem] [&_.ProseMirror_a]:text-blue-600 [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:cursor-pointer [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_p:last-child]:mb-0"
    />
  );
}

export default function ReviewDraftsPage() {
  const [drafts, setDrafts] = useState<EmailQuery[]>([]);
  const [editedReplies, setEditedReplies] = useState<Record<string, string>>({});
  const [contentVersions, setContentVersions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [gmailLoading, setGmailLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [intentOverrides, setIntentOverrides] = useState<Record<string, string>>({});
  const [ticketStatusOverrides, setTicketStatusOverrides] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [markingAsSent, setMarkingAsSent] = useState<Record<string, boolean>>({});
  const [senderName, setSenderName] = useState<string>("");
  const [filterIntent, setFilterIntent] = useState<string>("all");
  const [filterTicket, setFilterTicket] = useState<string>("all");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const fullName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        "";
      setSenderName(fullName.split(" ")[0]);
    });
  }, []);

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
          replies[d.id] = markdownLinksToHtml(d.suggested_reply || "");
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
    if (!reply.replace(/<[^>]*>/g, "").trim() || gmailLoading[draft.id]) return;

    setGmailLoading((prev) => ({ ...prev, [draft.id]: true }));
    setErrors((prev) => ({ ...prev, [draft.id]: "" }));

    try {
      const res = await fetch("/api/gmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply, subject: draft.subject, to: draft.from_address }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          [draft.id]: data.error || "Failed to create Gmail draft",
        }));
        return;
      }

      const url = data.messageId
        ? `https://mail.google.com/mail/#drafts/${data.messageId}`
        : "https://mail.google.com/mail/#drafts";
      window.open(url, "_blank");
    } catch {
      setErrors((prev) => ({
        ...prev,
        [draft.id]: "Failed to connect to Gmail. Please try again.",
      }));
    } finally {
      setGmailLoading((prev) => ({ ...prev, [draft.id]: false }));
    }
  }

  async function handleDelete(id: string) {
    setDeleting((prev) => ({ ...prev, [id]: true }));
    await fetch(`/api/email-queries/${id}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleMarkAsSent(id: string) {
    setMarkingAsSent((prev) => ({ ...prev, [id]: true }));
    await fetch(`/api/email-queries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, status: "approved" } : d));
    setMarkingAsSent((prev) => ({ ...prev, [id]: false }));
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
          sender_name: senderName,
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

      const html = markdownLinksToHtml(data.suggestedReply);
      setEditedReplies((prev) => ({ ...prev, [draft.id]: html }));
      setContentVersions((prev) => ({ ...prev, [draft.id]: (prev[draft.id] || 0) + 1 }));
    } catch {
      setErrors((prev) => ({
        ...prev,
        [draft.id]: "Failed to regenerate. Please try again.",
      }));
    } finally {
      setRegenerating((prev) => ({ ...prev, [draft.id]: false }));
    }
  }

  const intentOptions = ["all", "info", "action", "offer", "other"] as const;
  const ticketOptions = [
    { value: "all", label: "All" },
    { value: "purchased", label: "Purchased" },
    { value: "not_purchased", label: "Not purchased" },
    { value: "unknown", label: "Unknown" },
  ] as const;

  const visibleDrafts = drafts.filter((d) => {
    const intent = intentOverrides[d.id] || d.intent_category || "";
    const ticket = ticketStatusOverrides[d.id] || d.ticket_status || "";
    if (filterIntent !== "all" && intent !== filterIntent) return false;
    if (filterTicket !== "all" && ticket !== filterTicket) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 p-4 pt-14 lg:p-8">
      <h1 className="text-2xl font-semibold text-[#0e103a] font-machina">Review Drafts</h1>
      <p className="mt-1 text-sm text-gray-500">
        Review and send auto-generated replies to participant emails
      </p>

      {/* Filter bar */}
      {!loading && drafts.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-6">
          {/* Intent filter */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Intent</span>
            <div className="flex flex-wrap gap-1.5">
              {intentOptions.map((intent) => (
                <button
                  key={intent}
                  onClick={() => setFilterIntent(intent)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors cursor-pointer ${
                    filterIntent === intent
                      ? "bg-[#0e103a] text-white"
                      : "border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
                  }`}
                >
                  {intent === "all" ? "All" : intent}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket filter */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Ticket</span>
            <div className="flex flex-wrap gap-1.5">
              {ticketOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterTicket(value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    filterTicket === value
                      ? "bg-[#0e103a] text-white"
                      : "border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Active filter count */}
          {(filterIntent !== "all" || filterTicket !== "all") && (
            <span className="text-xs text-gray-400">
              {visibleDrafts.length} of {drafts.length} shown
              <button
                onClick={() => { setFilterIntent("all"); setFilterTicket("all"); }}
                className="ml-2 text-gray-400 underline hover:text-gray-600 cursor-pointer"
              >
                Clear
              </button>
            </span>
          )}
        </div>
      )}

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
              Forward any email to edgecityops@watsondeacon.com, then check back here to review an automatically generated response.
            </p>
          </div>
        )}

        {/* No results after filtering */}
        {!loading && drafts.length > 0 && visibleDrafts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-8 py-16 text-center">
            <p className="text-sm font-medium text-[#0e103a]">No drafts match these filters</p>
            <button
              onClick={() => { setFilterIntent("all"); setFilterTicket("all"); }}
              className="mt-2 text-xs text-gray-400 underline hover:text-gray-600 cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Draft cards */}
        {!loading &&
          visibleDrafts.map((draft) => {
            const isSent = draft.status === "approved";
            return (
            <div key={draft.id} className={`rounded-2xl border bg-white p-6 transition-all ${isSent ? "border-gray-100 opacity-50 grayscale" : "border-gray-200"}`}>
              {/* Card header */}
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#0e103a]">{draft.subject || "(No subject)"}</p>
                    {isSent && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-green-700">Sent</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">From</span>
                    <p className="text-xs text-gray-500">{draft.from_address || "Unknown sender"}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-gray-400">{timeAgo(draft.created_at)}</span>
              </div>

              {/* Intent + Ticket selectors */}
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-8">

                {/* Intent selector */}
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Intent</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(["info", "action", "offer", "other"] as const).map((intent) => {
                      const active = intentOverrides[draft.id] === intent;
                      const tooltips = {
                        info: "Seeking information, whether to make a purchase decision or assist with logistics",
                        action: "Taking a specific action, like a ticket transfer or cancellation",
                        offer: "Inbound vendors, partners, sponsors, volunteers, etc.",
                        other: "All other email intents",
                      };
                      return (
                        <div key={intent} className="relative group">
                          <button
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
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 text-center">
                            {tooltips[intent]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ticket status selector */}
                <div className="flex items-center gap-2">
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

              </div>{/* end intent + ticket row */}

              {/* Two-column body */}
              <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">

                {/* Left panel: received message */}
                <div className="flex flex-col lg:w-2/5">
                  <span className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Message</span>
                  <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 lg:max-h-96">
                    <p className="whitespace-pre-wrap break-words text-xs text-gray-500">{reflowEmail(draft.raw_email)}</p>
                  </div>
                </div>

                {/* Right panel: reply */}
                <div className="flex flex-1 flex-col">
                  <span className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Reply</span>
                  {editedReplies[draft.id] !== undefined && (
                    <DraftEditor
                      key={`${draft.id}-${contentVersions[draft.id] || 0}`}
                      draftId={draft.id}
                      initialContent={editedReplies[draft.id]}
                      onContentChange={(id, html) =>
                        setEditedReplies((prev) => ({ ...prev, [id]: html }))
                      }
                    />
                  )}
                </div>

              </div>{/* end two-column body */}

              {/* Error */}
              {errors[draft.id] && (
                <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {errors[draft.id]}
                </div>
              )}

              {/* Action row */}
              <div className="mt-3 flex justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(draft.id)}
                    disabled={deleting[draft.id] || isSent}
                    className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-400 hover:border-red-200 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {deleting[draft.id] ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    onClick={() => handleMarkAsSent(draft.id)}
                    disabled={markingAsSent[draft.id] || isSent}
                    className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-400 hover:border-green-200 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {isSent ? "Sent" : markingAsSent[draft.id] ? "Marking…" : "Mark as sent"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRegenerate(draft)}
                    disabled={regenerating[draft.id] || isSent}
                    className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {regenerating[draft.id] ? "Regenerating…" : "Regenerate reply"}
                  </button>
                  <button
                    onClick={() => handleOpenInGmail(draft)}
                    disabled={gmailLoading[draft.id] || isSent || !(editedReplies[draft.id] || "").replace(/<[^>]*>/g, "").trim()}
                    className="rounded-full bg-[#0e103a] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a0c2e] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {gmailLoading[draft.id] ? "Opening…" : "Open in Gmail"}
                  </button>
                </div>
              </div>
            </div>
            );
          })}
      </div>
    </div>
  );
}
