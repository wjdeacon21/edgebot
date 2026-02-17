import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch stats
  const [pdfRes, factsRes, queriesRes, recentRes, conflictRes, totalRecentRes] =
    await Promise.all([
      supabase
        .from("pdf_documents")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("structured_facts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("email_queries")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("email_queries")
        .select("id, raw_email, confidence_score, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("email_queries")
        .select("id", { count: "exact", head: true })
        .eq("conflict_flag", true)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from("email_queries")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

  const pdfCount = pdfRes.count || 0;
  const factsCount = factsRes.count || 0;
  const queriesCount = queriesRes.count || 0;
  const recentQueries = recentRes.data || [];
  const conflictCount = conflictRes.count || 0;
  const totalRecentCount = totalRecentRes.count || 0;
  const conflictRate =
    totalRecentCount > 0
      ? Math.round((conflictCount / totalRecentCount) * 100)
      : 0;

  const stats = [
    { label: "Active PDFs", value: pdfCount },
    { label: "Structured Facts", value: factsCount },
    { label: "Total Queries", value: queriesCount },
    { label: "Conflict Rate (7d)", value: `${conflictRate}%` },
  ];

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
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Operational overview
      </p>

      {/* Stats Cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-md border border-gray-200 bg-white p-5"
          >
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Queries */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-700">Recent Queries</h2>
        {recentQueries.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No queries yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {recentQueries.map(
              (q: {
                id: string;
                raw_email: string;
                confidence_score: string | null;
                status: string;
                created_at: string;
              }) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-gray-900">
                      {q.raw_email.slice(0, 80)}
                      {q.raw_email.length > 80 ? "..." : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(q.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2 shrink-0">
                    {q.confidence_score && (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          confidenceColors[q.confidence_score] || ""
                        }`}
                      >
                        {q.confidence_score}
                      </span>
                    )}
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[q.status] || ""
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
