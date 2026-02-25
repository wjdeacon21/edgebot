"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TipTapLink from "@tiptap/extension-link";
import { createClient } from "@/lib/supabase-browser";

interface GenerateResult {
  id: string;
  suggestedReply: string;
  subjectLine: string;
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

export default function DrafterPage() {
  const [rawEmail, setRawEmail] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [editedReply, setEditedReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [intentCategory, setIntentCategory] = useState<string>("");
  const [ticketStatus, setTicketStatus] = useState<string>("");
  const [senderName, setSenderName] = useState<string>("");

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
    content: "",
    onUpdate({ editor }) {
      setEditedReply(editor.getHTML());
    },
  });

  async function handleGenerate() {
    if (!rawEmail.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    editor?.commands.setContent("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawEmail, intentCategory, ticketStatus, senderName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      const html = markdownLinksToHtml(data.suggestedReply);
      setResult(data);
      setEditedReply(html);
      editor?.commands.setContent(html);
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
      editor?.commands.setContent("");
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
      setRawEmail("");
      setResult(null);
      setEditedReply("");
      editor?.commands.setContent("");
    }
  }

  async function handleOpenInGmail() {
    if (!editedReply.replace(/<[^>]*>/g, "").trim() || gmailLoading) return;

    setGmailLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/gmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editedReply, subject: result?.subjectLine }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create Gmail draft");
        return;
      }

      window.open(
        `https://mail.google.com/mail/#drafts`,
        "_blank"
      );
    } catch {
      setError("Failed to connect to Gmail. Please try again.");
    } finally {
      setGmailLoading(false);
    }
  }

  // Right pill styling based on state
  const canGenerate = rawEmail.trim() && !loading && !result;
  const rightPillClass = (() => {
    if (loading) {
      return "bg-[#0e103a] text-white opacity-75 cursor-wait";
    }
    if (result) {
      return "bg-white border border-gray-200 text-gray-700 cursor-default";
    }
    if (rawEmail.trim()) {
      return "bg-[#0e103a] text-white hover:bg-[#0a0c2e] cursor-pointer shadow-md shadow-[#0e103a]/20";
    }
    return "bg-white border border-gray-200 text-gray-400 cursor-default";
  })();

  // Shimmer on input card when empty and not focused
  const showInputShimmer = !rawEmail.trim() && !inputFocused;

  // Left panel goes grayscale once a draft exists (or is loading)
  const leftPanelDimmed = loading || !!result;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 p-4 pt-14 lg:p-8">
      <h1 className="text-2xl font-semibold text-[#0e103a] font-machina">Create Drafts</h1>
      <p className="mt-1 text-sm text-gray-500">
        Respond to FAQs from Edge Participants
      </p>

      <div className="mt-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column — Input */}
        <div className={`flex flex-col gap-4 transition-all duration-500 ${leftPanelDimmed ? "opacity-50 grayscale" : ""}`}>
          <div className={`rounded-xl px-6 py-3 text-center text-base font-bold transition-colors font-machina ${leftPanelDimmed ? "border border-gray-200 bg-white text-gray-400" : "bg-[#0e103a] text-white"}`}>
            Bring in an email or question below
          </div>
          {/* Intent + Ticket selectors */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="mb-3 text-[11px] text-gray-400">Select intent and ticket status to adjust draft tone</p>
            <div className="flex flex-col gap-2.5">

              {/* Intent pills */}
              <div className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Intent</span>
                <div className="flex flex-wrap gap-1.5">
                  {(["info", "action", "offer", "other"] as const).map((intent) => {
                    const tooltips = {
                      info: "Seeking information, whether to make a purchase decision or assist with logistics",
                      action: "Taking a specific action, like a ticket transfer or cancellation",
                      offer: "Inbound vendors, partners, sponsors, volunteers, etc.",
                      other: "All other email intents",
                    };
                    return (
                      <div key={intent} className="relative group">
                        <button
                          onClick={() => setIntentCategory((prev) => prev === intent ? "" : intent)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                            intentCategory === intent
                              ? "bg-[#0e103a] text-white"
                              : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
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

              {/* Ticket status pills */}
              <div className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Ticket</span>
                <div className="flex flex-wrap gap-1.5">
                  {(["purchased", "not_purchased", "unknown"] as const).map((status) => {
                    const label = status === "not_purchased" ? "Not purchased" : status.charAt(0).toUpperCase() + status.slice(1);
                    return (
                      <button
                        key={status}
                        onClick={() => setTicketStatus((prev) => prev === status ? "" : status)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                          ticketStatus === status
                            ? "bg-[#0e103a] text-white"
                            : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          <div className={`flex-1 rounded-2xl p-[2px] ${showInputShimmer ? "purple-shimmer" : "bg-gray-200"}`}>
            <div className="h-full rounded-2xl bg-white p-1">
              <textarea
                value={rawEmail}
                onChange={(e) => setRawEmail(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="What time should I check in..."
                className="h-full min-h-[400px] w-full resize-none rounded-2xl border-0 bg-transparent px-5 py-4 text-sm text-[#0e103a] placeholder-gray-400 focus:outline-none"
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
            className={`w-full rounded-full px-6 py-3 text-center text-base font-bold transition-colors font-machina ${rightPillClass}`}
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

            {/* Draft editor */}
            {!loading && result && (
              <EditorContent
                editor={editor}
                className="h-full min-h-[400px] px-5 py-4 text-sm text-[#0e103a] [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[380px] [&_.ProseMirror_a]:text-blue-600 [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:cursor-pointer [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_p:last-child]:mb-0"
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
                    className="flex-1 rounded-full bg-[#0e103a] py-2.5 text-center text-sm font-medium text-white hover:bg-[#0e103a]/90 cursor-pointer"
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
                  <button
                    onClick={handleOpenInGmail}
                    disabled={gmailLoading || !editedReply.replace(/<[^>]*>/g, "").trim()}
                    className="flex-1 rounded-full py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                  >
                    {gmailLoading ? "Opening..." : "Open in Gmail"}
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
