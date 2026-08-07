import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "Admin Dashboard · HireMe" };
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "lcy080813@gmail.com";

const DAY_MS = 24 * 60 * 60 * 1000;

// prompt_type is what actually distinguishes features in ai_events
// (event_type is always "document_generation_stream" for generations).
const FEATURE_LABELS: Record<string, string> = {
  "resume-tailor": "Resume",
  "cover-letter": "Cover letter",
  "interview-prep": "Interview",
  "email-draft": "Email",
  assessment: "Assessment",
  "resume-score": "Score",
  "job-parser": "Job parse",
  "resume-parser": "Resume parse",
  evidence: "Evidence",
  embedding: "Embedding",
};

type EventRow = {
  user_id: string;
  event_type: string;
  prompt_type: string | null;
  created_at: string;
};

function featureKey(e: EventRow) {
  return e.prompt_type ?? e.event_type;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

async function getDashboardData() {
  const admin = getSupabaseAdmin();

  const [usersRes, eventsRes, appsRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("ai_events")
      .select("user_id, event_type, prompt_type, created_at")
      .order("created_at", { ascending: false })
      .limit(10000),
    admin.from("job_applications").select("user_id").limit(10000),
  ]);

  const users = usersRes.data?.users ?? [];
  const events = (eventsRes.data ?? []) as EventRow[];
  const applications = (appsRes.data ?? []) as Array<{ user_id: string }>;

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const newToday = users.filter((u) => new Date(u.created_at).getTime() >= startOfToday.getTime()).length;
  const callsThisWeek = events.filter((e) => now - new Date(e.created_at).getTime() < 7 * DAY_MS).length;

  // Top feature overall
  const featureTotals = new Map<string, number>();
  for (const e of events) {
    const key = featureKey(e);
    featureTotals.set(key, (featureTotals.get(key) ?? 0) + 1);
  }
  const featureColumns = Array.from(featureTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
  const topFeature = featureColumns[0] ?? null;

  // Per-user aggregates
  const perUserFeature = new Map<string, Map<string, number>>();
  const lastEventAt = new Map<string, number>();
  for (const e of events) {
    const m = perUserFeature.get(e.user_id) ?? new Map<string, number>();
    const key = featureKey(e);
    m.set(key, (m.get(key) ?? 0) + 1);
    perUserFeature.set(e.user_id, m);
    const t = new Date(e.created_at).getTime();
    if (t > (lastEventAt.get(e.user_id) ?? 0)) lastEventAt.set(e.user_id, t);
  }

  const appCounts = new Map<string, number>();
  for (const a of applications) {
    appCounts.set(a.user_id, (appCounts.get(a.user_id) ?? 0) + 1);
  }

  const userRows = users
    .map((u) => {
      const signIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
      const lastActive = Math.max(signIn, lastEventAt.get(u.id) ?? 0);
      return {
        id: u.id,
        email: u.email ?? "—",
        createdAt: u.created_at,
        features: perUserFeature.get(u.id) ?? new Map<string, number>(),
        applications: appCounts.get(u.id) ?? 0,
        lastActive: lastActive > 0 ? lastActive : null,
      };
    })
    .sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));

  // Daily call counts, last 14 days (oldest first)
  const trend: Array<{ date: string; count: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(startOfToday.getTime() - i * DAY_MS);
    trend.push({
      date: day.toISOString().slice(0, 10),
      count: 0,
    });
  }
  const trendIndex = new Map(trend.map((t, i) => [t.date, i]));
  for (const e of events) {
    const idx = trendIndex.get(new Date(e.created_at).toISOString().slice(0, 10));
    if (idx != null) trend[idx].count++;
  }

  return {
    totalUsers: users.length,
    newToday,
    callsThisWeek,
    topFeature,
    featureColumns,
    userRows,
    trend,
  };
}

function formatDate(value: string | number | null) {
  if (value == null) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: number | null) {
  if (value == null) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminDashboardPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) notFound();

  const data = await getDashboardData();
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.count));

  return (
    <div className="app-page">
      <div className="app-page-container app-page-container-wide">
        <div className="app-page-header rise-enter">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            🔒 Admin
          </p>
          <h1 className="app-page-title">User Analytics</h1>
          <p className="app-page-subtitle">Usage across all accounts</p>
        </div>

        {/* Overview cards */}
        <div className="app-page-content grid grid-cols-2 gap-4 rise-enter [transition-delay:40ms] sm:grid-cols-4">
          <StatCard label="Total users" value={data.totalUsers} />
          <StatCard label="New today" value={data.newToday} />
          <StatCard label="API calls" value={data.callsThisWeek} sub="last 7 days" />
          <StatCard
            label="Top feature"
            value={data.topFeature ? (FEATURE_LABELS[data.topFeature] ?? data.topFeature) : "—"}
          />
        </div>

        {/* 14-day trend */}
        <section className="surface-card mt-6 overflow-hidden rise-enter [transition-delay:80ms]">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">API calls — last 14 days</h2>
          </div>
          <div className="flex items-end gap-1.5 px-5 pb-3 pt-6" style={{ height: 120 }}>
            {data.trend.map((t) => (
              <div key={t.date} className="group flex h-full flex-1 flex-col justify-end gap-1">
                <div
                  className="w-full rounded-t-sm bg-[var(--accent)] opacity-80 transition-opacity group-hover:opacity-100"
                  style={{
                    height: `${Math.max(t.count > 0 ? 6 : 2, (t.count / maxTrend) * 100)}%`,
                    ...(t.count === 0 ? { background: "var(--accent-border)" } : {}),
                  }}
                  title={`${t.date}: ${t.count}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between px-5 pb-3 text-[10px] tabular-nums text-muted-foreground">
            <span>{data.trend[0]?.date.slice(5)}</span>
            <span>{data.trend[data.trend.length - 1]?.date.slice(5)}</span>
          </div>
        </section>

        {/* User table */}
        <section className="surface-card mt-6 overflow-hidden rise-enter [transition-delay:120ms]">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Joined</th>
                  {data.featureColumns.map((key) => (
                    <th key={key} className="px-4 py-2 text-right font-medium">
                      {FEATURE_LABELS[key] ?? key}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-medium">Apps</th>
                  <th className="px-4 py-2 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {data.userRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + data.featureColumns.length}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  data.userRows.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium">{u.email}</td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </td>
                      {data.featureColumns.map((key) => (
                        <td key={key} className="px-4 py-2.5 text-right tabular-nums">
                          {u.features.get(key) ?? 0}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right tabular-nums">{u.applications}</td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">
                        {formatDateTime(u.lastActive)}
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
