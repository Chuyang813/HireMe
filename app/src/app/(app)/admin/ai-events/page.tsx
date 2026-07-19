import { getAiEventStats } from "@/app/actions/admin";

export const metadata = { title: "AI Events · HireMe" };

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function AiEventsPage() {
  const stats = await getAiEventStats();

  return (
    <div className="app-page">
      <div className="app-page-container app-page-container-wide">
      <div className="app-page-header rise-enter">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Admin · Observability
        </p>
        <h1 className="app-page-title">AI Events</h1>
        <p className="app-page-subtitle">Last 100 events</p>
      </div>

      {/* Stat cards */}
      <div className="app-page-content grid grid-cols-2 gap-4 rise-enter [transition-delay:40ms] sm:grid-cols-4">
        <StatCard label="Total events" value={stats.totalEvents} />
        <StatCard label="Success rate" value={`${stats.successRate}%`} />
        <StatCard
          label="Avg latency"
          value={stats.avgLatencyMs != null ? `${stats.avgLatencyMs} ms` : "—"}
        />
        <StatCard label="Errors" value={stats.errorCount} />
      </div>

      <div className="mt-6 grid gap-6 rise-enter [transition-delay:80ms] lg:grid-cols-2">
        {/* By model */}
        <section className="surface-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">By model</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Model</th>
                <th className="px-5 py-2 font-medium text-right">Count</th>
                <th className="px-5 py-2 font-medium text-right">Success</th>
              </tr>
            </thead>
            <tbody>
              {stats.byModel.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-4 text-center text-muted-foreground">
                    No data yet.
                  </td>
                </tr>
              ) : (
                stats.byModel.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 font-mono text-xs">{row.model ?? "—"}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{row.count}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{row.successRate}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* By prompt type */}
        <section className="surface-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">By prompt type</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Prompt type</th>
                <th className="px-5 py-2 font-medium text-right">Count</th>
                <th className="px-5 py-2 font-medium text-right">Avg latency</th>
              </tr>
            </thead>
            <tbody>
              {stats.byPromptType.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-4 text-center text-muted-foreground">
                    No data yet.
                  </td>
                </tr>
              ) : (
                stats.byPromptType.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 font-mono text-xs">{row.prompt_type ?? "—"}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{row.count}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {row.avgLatencyMs != null ? `${row.avgLatencyMs} ms` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* Recent events */}
      <section className="surface-card mt-6 overflow-hidden rise-enter [transition-delay:120ms]">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Recent events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Event type</th>
                <th className="px-4 py-2 font-medium">Prompt type</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-4 py-2 font-medium">Doc type</th>
                <th className="px-4 py-2 font-medium text-right">Latency</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                    No events yet.
                  </td>
                </tr>
              ) : (
                stats.recent.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono">{e.event_type}</td>
                    <td className="px-4 py-2 font-mono">{e.prompt_type ?? "—"}</td>
                    <td className="px-4 py-2 font-mono">{e.prompt_version ?? "—"}</td>
                    <td className="px-4 py-2 font-mono">{e.model ?? "—"}</td>
                    <td className="px-4 py-2">{e.document_type ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {e.latency_ms != null ? `${e.latency_ms} ms` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${
                          e.success
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }`}
                      >
                        {e.success ? "ok" : "err"}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-red-600 dark:text-red-400">
                      {e.error_message ?? ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </div>
  );
}
