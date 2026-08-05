import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import type { JobApplication, ApplicationStatus } from "@/lib/db/types";
import { APPLICATION_STATUS_LABEL } from "@/lib/db/types";
import { isDemoUser } from "@/lib/demo";
import { DemoExampleNotice } from "@/components/DemoNotices";

export const metadata = { title: "Insights" };

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function weekKey(iso: string) {
  const d = new Date(iso);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - day + 4);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week = Math.ceil(((thursday.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function shortWeekLabel(key: string) {
  const [year, wPart] = key.split("-W");
  const weekNum = Number(wPart);
  const jan1 = new Date(Number(year), 0, 1);
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() + (weekNum - 1) * 7 - jan1.getDay() + 1);
  return monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="surface-card p-5">
      <p className="label-caps text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel bar chart (inline SVG)
// ---------------------------------------------------------------------------

const FUNNEL_STATUSES: ApplicationStatus[] = [
  "applied",
  "assessment",
  "interview",
  "offer",
];

function FunnelChart({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(...FUNNEL_STATUSES.map((s) => counts[s] ?? 0), 1);
  const BAR_H = 28;
  const GAP = 10;
  const LABEL_W = 96;
  const COUNT_W = 32;
  const BAR_MAX = 260;
  const HEIGHT = FUNNEL_STATUSES.length * (BAR_H + GAP) - GAP;

  return (
    <svg
      viewBox={`0 0 ${LABEL_W + BAR_MAX + COUNT_W + 16} ${HEIGHT}`}
      className="w-full max-w-sm"
      aria-label="Application funnel"
    >
      {FUNNEL_STATUSES.map((status, i) => {
        const count = counts[status] ?? 0;
        const barW = count === 0 ? 2 : Math.max(4, (count / max) * BAR_MAX);
        const y = i * (BAR_H + GAP);
        return (
          <g key={status}>
            <text
              x={LABEL_W - 8}
              y={y + BAR_H / 2 + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              style={{ fill: "var(--color-muted-foreground)" }}
            >
              {APPLICATION_STATUS_LABEL[status]}
            </text>
            <rect
              x={LABEL_W}
              y={y}
              width={barW}
              height={BAR_H}
              rx="2"
              style={{ fill: "var(--color-accent)" }}
            />
            <text
              x={LABEL_W + barW + 6}
              y={y + BAR_H / 2 + 4}
              fontSize="11"
              style={{ fill: "var(--color-foreground)" }}
            >
              {count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Status breakdown (horizontal stacked bar)
// ---------------------------------------------------------------------------

const STATUS_COLORS: Partial<Record<ApplicationStatus, string>> = {
  saved: "#8f887c",
  ready_to_apply: "#c2bbac",
  applied: "#a3512b",
  assessment: "#5b83a6",
  interview: "#b08a2e",
  rejected: "#b04a44",
  offer: "#4c7d51",
  withdrawn: "#6b655c",
};

function StatusBreakdown({
  counts,
  total,
  noDataLabel,
}: {
  counts: Record<string, number>;
  total: number;
  noDataLabel: string;
}) {
  if (total === 0) return <p className="text-sm text-muted-foreground">{noDataLabel}</p>;

  const statuses = Object.entries(counts).filter(([, c]) => c > 0) as [ApplicationStatus, number][];

  return (
    <div className="space-y-2">
      <div className="flex h-5 w-full overflow-hidden rounded-sm">
        {statuses.map(([status, count]) => (
          <div
            key={status}
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: STATUS_COLORS[status] ?? "#8f887c",
            }}
            title={`${APPLICATION_STATUS_LABEL[status]}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {statuses.map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[status] ?? "#8f887c" }}
            />
            <span className="text-muted-foreground">
              {APPLICATION_STATUS_LABEL[status]}
            </span>
            <span className="font-medium">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applications over time (sparkline)
// ---------------------------------------------------------------------------

function SparkLine({
  weeklyData,
  noDataLabel,
}: {
  weeklyData: { label: string; count: number }[];
  noDataLabel: string;
}) {
  if (weeklyData.length === 0)
    return <p className="text-sm text-muted-foreground">{noDataLabel}</p>;

  const W = 400;
  const H = 80;
  const PAD = 8;
  const max = Math.max(...weeklyData.map((d) => d.count), 1);
  const xStep = weeklyData.length > 1 ? (W - PAD * 2) / (weeklyData.length - 1) : W - PAD * 2;

  const points = weeklyData.map((d, i) => {
    const x = PAD + i * xStep;
    const y = PAD + (1 - d.count / max) * (H - PAD * 2);
    return `${x},${y}`;
  });

  const area =
    `M ${PAD},${H - PAD} ` +
    weeklyData.map((d, i) => {
      const x = PAD + i * xStep;
      const y = PAD + (1 - d.count / max) * (H - PAD * 2);
      return `L ${x},${y}`;
    }).join(" ") +
    ` L ${PAD + (weeklyData.length - 1) * xStep},${H - PAD} Z`;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Applications over time">
        <path d={area} style={{ fill: "var(--color-accent)", opacity: 0.15 }} />
        <polyline
          points={points.join(" ")}
          fill="none"
          strokeWidth="1.5"
          style={{ stroke: "var(--color-accent)" }}
        />
        {weeklyData.map((d, i) => (
          <circle
            key={i}
            cx={PAD + i * xStep}
            cy={PAD + (1 - d.count / max) * (H - PAD * 2)}
            r="3"
            style={{ fill: "var(--color-accent)" }}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {weeklyData.length > 0 && (
          <>
            <span>{weeklyData[0].label}</span>
            {weeklyData.length > 1 && (
              <span>{weeklyData[weeklyData.length - 1].label}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function InsightsPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Insights");
  const demoT = await getTranslations("Demo");
  const isDemo = isDemoUser(user);

  const { data } = await supabase
    .from("job_applications")
    .select("company_name, current_status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const userApps = (data ?? []) as Pick<JobApplication, "company_name" | "current_status" | "created_at">[];
  const sampleApps: Pick<JobApplication, "company_name" | "current_status" | "created_at">[] = isDemo
    ? [
        { company_name: "Northstar Labs", current_status: "applied", created_at: "2026-07-01T12:00:00.000Z" },
        { company_name: "Cedar Health", current_status: "assessment", created_at: "2026-07-08T12:00:00.000Z" },
        { company_name: "Atlas Cloud", current_status: "interview", created_at: "2026-07-15T12:00:00.000Z" },
        { company_name: "Brightworks", current_status: "rejected", created_at: "2026-07-22T12:00:00.000Z" },
        { company_name: "Atlas Cloud", current_status: "offer", created_at: "2026-07-29T12:00:00.000Z" },
      ]
    : [];
  const apps = [...sampleApps, ...userApps].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const total = apps.length;
  const activeStatuses = new Set<ApplicationStatus>(["applied", "assessment", "interview"]);
  const active = apps.filter((a) => activeStatuses.has(a.current_status)).length;

  const progressed = apps.filter((a) =>
    (["assessment", "interview", "offer"] as ApplicationStatus[]).includes(a.current_status)
  ).length;
  const interviewRate = total > 0 ? Math.round((progressed / total) * 100) : 0;

  const offers = apps.filter((a) => a.current_status === "offer").length;
  const offerRate = total > 0 ? Math.round((offers / total) * 100) : 0;

  const statusCounts: Record<string, number> = {};
  for (const app of apps) {
    statusCounts[app.current_status] = (statusCounts[app.current_status] ?? 0) + 1;
  }

  const companyCounts: Record<string, number> = {};
  for (const app of apps) {
    const co = app.company_name ?? "Unknown";
    companyCounts[co] = (companyCounts[co] ?? 0) + 1;
  }
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const weekMap: Record<string, number> = {};
  for (const app of apps) {
    const key = weekKey(app.created_at);
    weekMap[key] = (weekMap[key] ?? 0) + 1;
  }
  const sortedWeeks = Object.keys(weekMap).sort();
  const weeklyData = sortedWeeks.map((k) => ({
    label: shortWeekLabel(k),
    count: weekMap[k],
  }));

  return (
    <div className="app-page">
      <div className="app-page-container">
        <div className="app-page-header rise-enter">
          <div className="label-caps mb-2">{t("analyticsLabel")}</div>
          <h1 className="app-page-title">{t("heading")}</h1>
          <p className="app-page-subtitle">{t("headingSub")}</p>
        </div>

        {isDemo ? (
          <div className="mt-6 rise-enter [transition-delay:20ms]">
            <DemoExampleNotice title={demoT("insightsTitle")}>
              {demoT("insightsBody")}
            </DemoExampleNotice>
          </div>
        ) : null}

      <div className="app-page-content grid grid-cols-2 gap-4 rise-enter [transition-delay:40ms] sm:grid-cols-4">
        <StatCard label={t("totalApplied")} value={total} />
        <StatCard label={t("interviewRate")} value={`${interviewRate}%`} sub={t("interviewRateSub")} />
        <StatCard label={t("offerRate")} value={`${offerRate}%`} sub={t("offerRateSub")} />
        <StatCard label={t("active")} value={active} sub={t("activeSub")} />
      </div>

        <div className="mt-6 grid gap-6 rise-enter [transition-delay:80ms] lg:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="label-caps mb-5">{t("funnelHeading")}</h2>
          <div>
            <FunnelChart counts={statusCounts} />
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="label-caps mb-5">{t("statusBreakdownHeading")}</h2>
          <div>
            <StatusBreakdown counts={statusCounts} total={total} noDataLabel={t("noData")} />
          </div>
        </section>

        <section className="surface-card p-5 lg:col-span-2">
          <h2 className="label-caps mb-5">{t("overTimeHeading")}</h2>
          <div>
            {weeklyData.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noApps")}</p>
            ) : (
              <SparkLine weeklyData={weeklyData} noDataLabel={t("noData")} />
            )}
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="label-caps mb-5">{t("topCompaniesHeading")}</h2>
          <div>
            {topCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noData")}</p>
            ) : (
              <ul className="space-y-3">
                {topCompanies.map(([company, count]) => {
                  const pct = Math.round((count / total) * 100);
                  return (
                    <li key={company}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{company}</span>
                        <span className="label-caps text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
