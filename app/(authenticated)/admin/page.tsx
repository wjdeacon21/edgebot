"use client";

import { useEffect, useState } from "react";
import { useUserRole } from "@/lib/useUserRole";

interface UserRole {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

interface HealthStats {
  totalChunks: number;
  totalEmbeddings: number;
  activeDocs: number;
  activeFacts: number;
}

export default function AdminPage() {
  const { isAdmin, role } = useUserRole();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [health, setHealth] = useState<HealthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reembedding, setReembedding] = useState(false);
  const [reembedResult, setReembedResult] = useState<string | null>(null);

  useEffect(() => {
    if (role === null) return;
    if (!isAdmin) return;

    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/health").then((r) => r.json()),
    ]).then(([usersData, healthData]) => {
      setUsers(Array.isArray(usersData) ? usersData : []);
      setHealth(healthData);
      setLoading(false);
    });
  }, [isAdmin, role]);

  async function handleRoleChange(id: string, newRole: string) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role: newRole }),
    });

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
    );
  }

  async function handleReembed() {
    if (!confirm("Re-generate embeddings for all active chunks? This may take a while.")) return;

    setReembedding(true);
    setReembedResult(null);

    try {
      const res = await fetch("/api/admin/reembed", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setReembedResult(
          `Done. ${data.updated} updated, ${data.failed} failed out of ${data.total} chunks.`
        );
      } else {
        setReembedResult(`Error: ${data.error}`);
      }
    } catch {
      setReembedResult("Network error.");
    } finally {
      setReembedding(false);
    }
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
      <h1 className="text-2xl font-semibold text-[#0e103a]">Admin</h1>
      <p className="mt-1 text-sm text-gray-500">User management and system health</p>

      {loading ? (
        <p className="mt-6 text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          {/* System Health */}
          <div className="mt-6">
            <h2 className="text-sm font-medium text-gray-700">System Health</h2>
            {health && (
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-md border border-gray-200 bg-white p-5">
                  <p className="text-sm text-gray-500">Active Documents</p>
                  <p className="mt-1 text-2xl font-semibold text-[#0e103a]">
                    {health.activeDocs}
                  </p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-5">
                  <p className="text-sm text-gray-500">Active Facts</p>
                  <p className="mt-1 text-2xl font-semibold text-[#0e103a]">
                    {health.activeFacts}
                  </p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-5">
                  <p className="text-sm text-gray-500">Total Chunks</p>
                  <p className="mt-1 text-2xl font-semibold text-[#0e103a]">
                    {health.totalChunks}
                  </p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-5">
                  <p className="text-sm text-gray-500">Embeddings</p>
                  <p className="mt-1 text-2xl font-semibold text-[#0e103a]">
                    {health.totalEmbeddings}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Re-embedding */}
          <div className="mt-8">
            <h2 className="text-sm font-medium text-gray-700">Re-embedding</h2>
            <p className="mt-1 text-xs text-gray-400">
              Re-generate embeddings for all chunks from active documents.
            </p>
            <button
              onClick={handleReembed}
              disabled={reembedding}
              className="mt-3 rounded-md bg-[#0e103a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e103a]/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {reembedding ? "Re-embedding..." : "Re-embed All Chunks"}
            </button>
            {reembedResult && (
              <p className="mt-3 text-sm text-gray-600">{reembedResult}</p>
            )}
          </div>

          {/* User Management */}
          <div className="mt-8">
            <h2 className="text-sm font-medium text-gray-700">User Management</h2>
            {users.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">No users found.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 pr-6 font-medium">Email</th>
                      <th className="pb-2 pr-6 font-medium">Role</th>
                      <th className="pb-2 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100">
                        <td className="py-3 pr-6 text-[#0e103a]">{u.email}</td>
                        <td className="py-3 pr-6">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              handleRoleChange(u.id, e.target.value)
                            }
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-[#0e103a] focus:border-gray-500 focus:outline-none"
                          >
                            <option value="admin">Admin</option>
                            <option value="ops_reviewer">Ops Reviewer</option>
                          </select>
                        </td>
                        <td className="py-3 text-gray-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
