"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { PdfDocument } from "@/types";
import { useUserRole } from "@/lib/useUserRole";

export default function SourcesPage() {
  const { isAdmin } = useUserRole();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  async function fetchDocuments() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pdf_documents")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
    setLoadingDocs(false);
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", message: data.error || "Upload failed" });
      } else {
        setFeedback({
          type: "success",
          message: `Uploaded successfully. ${data.chunkCount} chunks created.`,
        });
        setFile(null);
        fetchDocuments();
      }
    } catch {
      setFeedback({ type: "error", message: "Network error. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document and all its chunks? This cannot be undone.")) return;

    const res = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
    });
    if (res.ok) fetchDocuments();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Sources</h1>
      <p className="mt-1 text-sm text-gray-500">Upload and manage PDF documents</p>

      {/* Upload Form (admin only) */}
      {isAdmin && (
        <div className="mt-6 max-w-lg rounded-md border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-700">Upload PDF</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-600">File</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>

          {feedback && (
            <div
              className={`mt-4 rounded-md p-3 text-sm ${
                feedback.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {feedback.message}
            </div>
          )}
        </div>
      )}

      {/* Document List */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-700">Ingested Documents</h2>

        {loadingDocs ? (
          <p className="mt-4 text-sm text-gray-400">Loading...</p>
        ) : documents.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No documents uploaded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-6 font-medium">Name</th>
                  <th className="pb-2 pr-6 font-medium">Uploaded</th>
                  <th className="pb-2 pr-6 font-medium">Status</th>
                  {isAdmin && <th className="pb-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-100">
                    <td className="py-3 pr-6 text-gray-900">{doc.name}</td>
                    <td className="py-3 pr-6 text-gray-600">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-6">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          doc.status === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3">
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="text-xs text-gray-500 hover:text-red-600 cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
