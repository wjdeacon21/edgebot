"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { StructuredFact } from "@/types";
import { useUserRole } from "@/lib/useUserRole";

const CATEGORIES = [
  "Arrival & Departure",
  "Ticket inclusions",
  "Accommodation",
  "Refund policy",
  "WiFi & coworking",
  "Programming structure",
  "Attendance flexibility",
  "Other",
];

const EMPTY_FORM = {
  category: CATEGORIES[0],
  key: "",
  value: "",
  source_document: "",
  page_number: "",
  confidence: "high" as "high" | "medium" | "low",
};

export default function StructuredFactsPage() {
  const { isAdmin } = useUserRole();
  const [facts, setFacts] = useState<StructuredFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const supabase = createClient();

  const fetchFacts = useCallback(async () => {
    let query = supabase
      .from("structured_facts")
      .select("*")
      .order("category")
      .order("key");

    if (filterCategory) {
      query = query.eq("category", filterCategory);
    }

    const { data, error } = await query;
    if (!error && data) setFacts(data);
    setLoading(false);
  }, [filterCategory, supabase]);

  useEffect(() => {
    fetchFacts();
  }, [fetchFacts]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setFeedback(null);
  }

  function startEdit(fact: StructuredFact) {
    setForm({
      category: fact.category,
      key: fact.key,
      value: fact.value,
      source_document: fact.source_document || "",
      page_number: fact.page_number?.toString() || "",
      confidence: fact.confidence,
    });
    setEditingId(fact.id);
    setShowForm(true);
    setFeedback(null);
  }

  async function handleSave() {
    if (!form.key.trim() || !form.value.trim()) {
      setFeedback({ type: "error", message: "Key and value are required." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const record = {
      category: form.category,
      key: form.key.trim(),
      value: form.value.trim(),
      source_document: form.source_document.trim() || null,
      page_number: form.page_number ? parseInt(form.page_number) : null,
      confidence: form.confidence,
      last_verified: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase
        .from("structured_facts")
        .update(record)
        .eq("id", editingId);
      if (error) {
        setFeedback({ type: "error", message: error.message });
      } else {
        setFeedback({ type: "success", message: "Fact updated." });
        resetForm();
        fetchFacts();
      }
    } else {
      const { error } = await supabase.from("structured_facts").insert(record);
      if (error) {
        setFeedback({ type: "error", message: error.message });
      } else {
        setFeedback({ type: "success", message: "Fact added." });
        resetForm();
        fetchFacts();
      }
    }

    setSaving(false);
  }

  async function handleDeprecate(id: string) {
    const { error } = await supabase
      .from("structured_facts")
      .update({ status: "deprecated" })
      .eq("id", id);
    if (!error) fetchFacts();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Structured Facts</h1>
          <p className="mt-1 text-sm text-gray-500">Deterministic truth layer</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 cursor-pointer"
          >
            Add New Fact
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="mt-6">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mt-6 max-w-lg rounded-md border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-700">
            {editingId ? "Edit Fact" : "Add New Fact"}
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-600">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600">Key</label>
              <input
                type="text"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="e.g. Check-in time"
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Value</label>
              <input
                type="text"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="e.g. 2:00 PM – 6:00 PM"
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Source Document</label>
              <input
                type="text"
                value={form.source_document}
                onChange={(e) => setForm({ ...form, source_document: e.target.value })}
                placeholder="e.g. Edge City Master Guide v2"
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-600">Page Number</label>
                <input
                  type="number"
                  value={form.page_number}
                  onChange={(e) => setForm({ ...form, page_number: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-600">Confidence</label>
                <select
                  value={form.confidence}
                  onChange={(e) => setForm({ ...form, confidence: e.target.value as "high" | "medium" | "low" })}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Add"}
              </button>
              <button
                onClick={resetForm}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
          {feedback && (
            <div className={`mt-4 rounded-md p-3 text-sm ${
              feedback.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {feedback.message}
            </div>
          )}
        </div>
      )}

      {/* Facts Table */}
      <div className="mt-8 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : facts.length === 0 ? (
          <p className="text-sm text-gray-400">No structured facts yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Category</th>
                <th className="pb-2 pr-4 font-medium">Key</th>
                <th className="pb-2 pr-4 font-medium">Value</th>
                <th className="pb-2 pr-4 font-medium">Source</th>
                <th className="pb-2 pr-4 font-medium">Page</th>
                <th className="pb-2 pr-4 font-medium">Confidence</th>
                <th className="pb-2 pr-4 font-medium">Verified</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                {isAdmin && <th className="pb-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {facts.map((fact) => (
                <tr key={fact.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-600">{fact.category}</td>
                  <td className="py-3 pr-4 text-gray-900 font-medium">{fact.key}</td>
                  <td className="py-3 pr-4 text-gray-900">{fact.value}</td>
                  <td className="py-3 pr-4 text-gray-500">{fact.source_document || "—"}</td>
                  <td className="py-3 pr-4 text-gray-500">{fact.page_number ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      fact.confidence === "high"
                        ? "bg-green-50 text-green-700"
                        : fact.confidence === "medium"
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-red-50 text-red-700"
                    }`}>
                      {fact.confidence}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(fact.last_verified).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      fact.status === "active"
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {fact.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 whitespace-nowrap">
                      {fact.status === "active" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(fact)}
                            className="text-gray-500 hover:text-gray-900 text-xs cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeprecate(fact.id)}
                            className="text-gray-500 hover:text-amber-600 text-xs cursor-pointer"
                          >
                            Deprecate
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
