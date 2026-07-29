import {
  FunnelChart,
  PageViewsTrendChart,
  StatusBarChart,
  TranslationMeter,
} from "@/components/dashboard/DashboardCharts";
import type { DashboardMetricsData } from "@/lib/catalog/dashboard-metrics";
import type { Dictionary } from "@/lib/i18n/getDictionary";
import { translate } from "@/lib/i18n/getDictionary";

type DashboardMetricsProps = {
  dictionary: Dictionary;
  metrics: DashboardMetricsData;
  welcomeName?: string | null;
  isAdmin?: boolean;
  /** Dense layout that fills the admin home viewport without page scroll. */
  fitViewport?: boolean;
};

type MetricCard = {
  id: string;
  label: string;
  value: string;
  tag: string;
  tone: "gold" | "amber" | "slate" | "emerald" | "sky";
};

function toneClass(tone: MetricCard["tone"]): string {
  switch (tone) {
    case "gold":
      return "bg-brand-50 text-brand-800 ring-brand-600/20";
    case "amber":
      return "bg-amber-50 text-amber-800 ring-amber-600/20";
    case "emerald":
      return "bg-emerald-50 text-emerald-800 ring-emerald-600/20";
    case "sky":
      return "bg-sky-50 text-sky-800 ring-sky-600/20";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-500/15";
  }
}

function CompactStat({
  card,
  dense,
}: {
  card: MetricCard;
  dense?: boolean;
}) {
  return (
    <article
      className={`flex min-w-0 flex-col gap-1 rounded-xl border border-slate-200/90 bg-white/95 shadow-[var(--shadow-card)] ${
        dense ? "px-3 py-2" : "gap-1.5 px-3.5 py-3"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={`font-semibold leading-snug text-ink-muted ${
            dense ? "text-[11px]" : "text-xs"
          }`}
        >
          {card.label}
        </h3>
        <span
          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ring-1 ring-inset ${toneClass(card.tone)}`}
        >
          {card.tag}
        </span>
      </div>
      <p
        className={`font-bold tabular-nums tracking-tight text-slate-deep ${
          dense ? "text-xl" : "text-2xl"
        }`}
      >
        {card.value}
      </p>
    </article>
  );
}

export function DashboardMetrics({
  dictionary,
  metrics,
  welcomeName,
  isAdmin = false,
  fitViewport = false,
}: DashboardMetricsProps) {
  const m = dictionary.dashboard.metrics;
  const charts = dictionary.dashboard.charts;
  const sections = dictionary.dashboard.sections;
  const admin = metrics.admin;

  const overviewPrimary: MetricCard[] = [
    {
      id: "active",
      label: m.active,
      value: String(metrics.activeListings),
      tag: m.activeTag,
      tone: "gold",
    },
    {
      id: "pending",
      label: m.pending,
      value: String(metrics.pendingApprovals),
      tag: m.pendingTag,
      tone: "amber",
    },
  ];

  const adminStatCards: MetricCard[] =
    isAdmin && admin
      ? [
          {
            id: "projects",
            label: m.projectsPending,
            value: String(admin.projectsPending),
            tag: m.projectsPendingTag,
            tone: "amber",
          },
          {
            id: "alerts",
            label: m.unreadAlerts,
            value: String(admin.unreadAlerts),
            tag: m.unreadAlertsTag,
            tone: "sky",
          },
          {
            id: "pub-count",
            label: m.listingsPublished,
            value: String(admin.listingsPublished),
            tag: m.listingsPublishedTag,
            tone: "emerald",
          },
          {
            id: "audit-count",
            label: m.listingsPendingAudit,
            value: String(admin.listingsPendingAudit),
            tag: m.listingsPendingAuditTag,
            tone: "amber",
          },
        ]
      : [];

  if (fitViewport) {
    return (
      <section
        id="dashboard"
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden"
        aria-labelledby="home-dashboard-title"
      >
        <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
          <h2
            id="home-dashboard-title"
            className="text-lg font-bold tracking-tight text-slate-deep sm:text-xl"
          >
            {welcomeName
              ? translate(dictionary, "dashboard.welcome", { name: welcomeName })
              : dictionary.dashboard.title}
          </h2>
          {isAdmin && admin ? (
            <p className="font-mono text-[10px] text-slate-400">
              v{admin.version.appVersion} · {admin.version.commitShort} ·{" "}
              {admin.version.environment}
            </p>
          ) : null}
        </header>

        <div className="grid shrink-0 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {overviewPrimary.map((card) => (
            <CompactStat key={card.id} card={card} dense />
          ))}
          <div className="sm:col-span-1">
            <TranslationMeter
              label={m.translation}
              percent={metrics.translationRate}
              tag={m.translationTag}
              dense
            />
          </div>
          {adminStatCards.map((card) => (
            <CompactStat key={card.id} card={card} dense />
          ))}
        </div>

        {isAdmin && admin ? (
          <div className="grid min-h-0 flex-1 gap-2.5 overflow-hidden lg:grid-cols-3">
            <StatusBarChart
              title={charts?.listingsByStatus ?? "Listings by status"}
              emptyLabel={charts?.empty ?? "No data yet"}
              dense
              segments={[
                {
                  id: "pub",
                  label: m.listingsPublished,
                  value: admin.listingsPublished,
                  color: "#059669",
                },
                {
                  id: "audit",
                  label: m.listingsPendingAudit,
                  value: admin.listingsPendingAudit,
                  color: "#d97706",
                },
                {
                  id: "ready",
                  label: m.listingsReady,
                  value: admin.listingsReady,
                  color: "#b45309",
                },
                {
                  id: "draft",
                  label: m.listingsDraft,
                  value: admin.listingsDraft,
                  color: "#64748b",
                },
              ]}
            />
            <FunnelChart
              title={charts?.smsFunnel ?? "Invite SMS funnel"}
              emptyLabel={charts?.empty ?? "No data yet"}
              dense
              steps={[
                {
                  id: "pending",
                  label: m.smsPending,
                  value: admin.scrapeInvitesPending,
                  color: "#d97706",
                },
                {
                  id: "sent",
                  label: m.smsSent,
                  value: admin.smsSent,
                  color: "#059669",
                },
                {
                  id: "failed",
                  label: m.smsFailed,
                  value: admin.smsFailed,
                  color: "#dc2626",
                },
              ]}
            />
            <PageViewsTrendChart
              title={charts?.pageViewsTrend ?? "Page views (7 days)"}
              series={admin.pageViewsSeries ?? []}
              todayLabel={m.pageViewsToday}
              weekLabel={m.pageViewsWeek}
              todayValue={admin.pageViewsToday}
              weekValue={admin.pageViewsLast7Days}
              emptyLabel={charts?.empty ?? "No traffic recorded yet"}
              dense
            />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      id="dashboard"
      className="flex flex-col gap-5"
      aria-labelledby="home-dashboard-title"
    >
      <header className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
          {dictionary.dashboard.eyebrow}
        </p>
        <h2
          id="home-dashboard-title"
          className="text-balance text-xl font-bold tracking-tight text-slate-deep sm:text-2xl"
        >
          {welcomeName
            ? translate(dictionary, "dashboard.welcome", { name: welcomeName })
            : dictionary.dashboard.title}
        </h2>
        <p className="max-w-2xl text-pretty text-sm text-ink-muted">
          {isAdmin && dictionary.dashboard.adminLede
            ? dictionary.dashboard.adminLede
            : dictionary.dashboard.lede}
        </p>
      </header>

      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          {sections?.overview ?? "Market overview"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {overviewPrimary.map((card) => (
            <CompactStat key={card.id} card={card} />
          ))}
          <TranslationMeter
            label={m.translation}
            percent={metrics.translationRate}
            tag={m.translationTag}
          />
        </div>
      </div>

      {isAdmin && admin ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <StatusBarChart
              title={charts?.listingsByStatus ?? "Listings by status"}
              emptyLabel={charts?.empty ?? "No data yet"}
              segments={[
                {
                  id: "pub",
                  label: m.listingsPublished,
                  value: admin.listingsPublished,
                  color: "#059669",
                },
                {
                  id: "audit",
                  label: m.listingsPendingAudit,
                  value: admin.listingsPendingAudit,
                  color: "#d97706",
                },
                {
                  id: "ready",
                  label: m.listingsReady,
                  value: admin.listingsReady,
                  color: "#b45309",
                },
                {
                  id: "draft",
                  label: m.listingsDraft,
                  value: admin.listingsDraft,
                  color: "#64748b",
                },
              ]}
            />
            <FunnelChart
              title={charts?.smsFunnel ?? "Invite SMS funnel"}
              emptyLabel={charts?.empty ?? "No data yet"}
              steps={[
                {
                  id: "pending",
                  label: m.smsPending,
                  value: admin.scrapeInvitesPending,
                  color: "#d97706",
                },
                {
                  id: "sent",
                  label: m.smsSent,
                  value: admin.smsSent,
                  color: "#059669",
                },
                {
                  id: "failed",
                  label: m.smsFailed,
                  value: admin.smsFailed,
                  color: "#dc2626",
                },
              ]}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {adminStatCards.map((card) => (
              <CompactStat key={card.id} card={card} />
            ))}
          </div>

          <PageViewsTrendChart
            title={charts?.pageViewsTrend ?? "Page views (7 days)"}
            series={admin.pageViewsSeries ?? []}
            todayLabel={m.pageViewsToday}
            weekLabel={m.pageViewsWeek}
            todayValue={admin.pageViewsToday}
            weekValue={admin.pageViewsLast7Days}
            emptyLabel={charts?.empty ?? "No traffic recorded yet"}
          />

          <footer className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 text-xs text-slate-600">
            <span className="font-bold uppercase tracking-[0.1em] text-slate-400">
              {sections?.version ?? "Deploy"}
            </span>
            <span className="rounded-md bg-white px-2 py-0.5 font-mono font-semibold text-slate-800 ring-1 ring-slate-200">
              v{admin.version.appVersion}
            </span>
            <span className="rounded-md bg-white px-2 py-0.5 font-mono font-semibold text-slate-800 ring-1 ring-slate-200">
              {admin.version.commitShort}
            </span>
            <span className="rounded-md bg-white px-2 py-0.5 font-semibold capitalize text-slate-800 ring-1 ring-slate-200">
              {admin.version.environment}
            </span>
          </footer>
        </>
      ) : null}
    </section>
  );
}
