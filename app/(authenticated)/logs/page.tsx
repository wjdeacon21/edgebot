"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase-browser";
import { EmailQuery } from "@/types";

export default function LogsPage() {
  const [queries, setQueries] = useState<EmailQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [confidenceFilter, setConfidenceFilter] = useState("");
  const [conflictFilter, setConflictFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const supabase = createClient();

  const fetchQueries = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("email_queries")
      .select("*")
      .order("created_at", { ascending: false });

    if (confidenceFilter) {
      query = query.eq("confidence_score", confidenceFilter);
    }
    if (conflictFilter) {
      query = query.eq("conflict_flag", true);
    }
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    if (dateFrom) {
      query = query.gte("created_at", new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setDate(end.getDate() + 1);
      query = query.lt("created_at", end.toISOString());
    }

    const { data, error } = await query;
    if (!error && data) setQueries(data);
    setLoading(false);
  }, [confidenceFilter, conflictFilter, statusFilter, dateFrom, dateTo, supabase]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  const confidenceColors: Record<string, string> = {
    high: "bg-green-50 text-green-700",
    medium: "bg-yellow-50 text-yellow-700",
    low: "bg-red-50 text-red-700",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    approved: "bg-green-50 text-green-700",
    escalated: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Logs</h1>
      <p className="mt-1 text-sm text-gray-500">Query history and audit trail</p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500">Confidence</label>
          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="escalated">Escalated</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="conflict-filter"
            checked={conflictFilter}
            onChange={(e) => setConflictFilter(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="conflict-filter" className="text-sm text-gray-600">
            Conflicts only
          </label>
        </div>
        <div>
          <label className="block text-xs text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : queries.length === 0 ? (
          <p className="text-sm text-gray-400">No queries found.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Timestamp</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Confidence</th>
                <th className="pb-2 pr-4 font-medium">Conflict</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Approved By</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => (
                <Fragment key={q.id}>
                  <tr
                    onClick={() =>
                      setExpandedId(expandedId === q.id ? null : q.id)
                    }
                    className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                  >
                    <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                      {new Date(q.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-gray-900 max-w-xs truncate">
                      {q.raw_email.slice(0, 80)}
                      {q.raw_email.length > 80 ? "..." : ""}
                    </td>
                    <td className="py-3 pr-4">
                      {q.confidence_score && (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            confidenceColors[q.confidence_score] || ""
                          }`}
                        >
                          {q.confidence_score}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {q.conflict_flag && (
                        <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          yes
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[q.status] || ""
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500 text-xs">
                      {q.approved_by || "—"}
                    </td>
                  </tr>
                  {expandedId === q.id && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={6} className="p-4 bg-gray-50">
                        <div className="space-y-4 text-sm">
                          <div>
                            <p className="font-medium text-gray-700">Raw Email</p>
                            <p className="mt-1 whitespace-pre-wrap text-gray-800">
                              {q.raw_email}
                            </p>
                          </div>
                          {q.suggested_reply && (
                            <div>
                              <p className="font-medium text-gray-700">
                                Suggested Reply
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-gray-800">
                                {q.suggested_reply}
                              </p>
                            </div>
                          )}
                          {q.approved_version && (
                            <div>
                              <p className="font-medium text-gray-700">
                                Approved Version
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-gray-800">
                                {q.approved_version}
                              </p>
                            </div>
                          )}
                          {q.sources_used && (
                            <div>
                              <p className="font-medium text-gray-700">
                                Sources Used
                              </p>
                              <ul className="mt-1 space-y-1">
                                {q.sources_used.map((s, i) => (
                                  <li key={i} className="text-gray-600">
                                    [{s.source_type}] page {s.page_number ?? "N/A"}
                                    : {s.snippet}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
