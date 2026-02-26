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
  "Locations",
  "Other",
];

const EMPTY_FORM = {
  category: CATEGORIES[0],
  key: "",
  value: "",
  is_link: false,
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
      is_link: fact.is_link ?? false,
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
      is_link: form.is_link,
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
      <div>
        <h1 className="text-2xl font-semibold text-[#0e103a] font-machina">Structured Inputs</h1>
        <p className="mt-1 text-sm text-gray-500">Deterministic truth layer</p>
      </div>

      {/* Filter + Add */}
      <div className="mt-6 flex items-center gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-[#0e103a] focus:border-gray-500 focus:outline-none"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="rounded-md bg-[#0e103a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e103a]/90 cursor-pointer"
          >
            Add New Fact
          </button>
        )}
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
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-[#0e103a] focus:border-gray-500 focus:outline-none"
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
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-[#0e103a] focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Value</label>
              <input
                type="text"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="e.g. 2:00 PM – 6:00 PM"
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-[#0e103a] focus:border-gray-500 focus:outline-none"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.is_link}
                onChange={(e) => setForm({ ...form, is_link: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-[#0e103a] cursor-pointer"
              />
              <span className="text-sm text-gray-600">Value is a link — Claude will format it as a hyperlink when mentioned</span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-[#0e103a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e103a]/90 disabled:opacity-50 cursor-pointer"
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
                <th className="pb-2 pr-4 font-medium">Link</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                {isAdmin && <th className="pb-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {facts.map((fact) => (
                <tr key={fact.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-600">{fact.category}</td>
                  <td className="py-3 pr-4 text-[#0e103a] font-medium">{fact.key}</td>
                  <td className="py-3 pr-4 text-[#0e103a] max-w-xs truncate">{fact.value}</td>
                  <td className="py-3 pr-4">
                    {fact.is_link && (
                      <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">link</span>
                    )}
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
                            className="text-gray-500 hover:text-[#0e103a] text-xs cursor-pointer"
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
