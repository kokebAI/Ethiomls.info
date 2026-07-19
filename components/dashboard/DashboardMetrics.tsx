import type { DashboardMetricsData } from "@/lib/catalog/dashboard-metrics";
import type { Dictionary } from "@/lib/i18n/getDictionary";
import { translate } from "@/lib/i18n/getDictionary";

type DashboardMetricsProps = {
  dictionary: Dictionary;
  metrics: DashboardMetricsData;
  welcomeName?: string | null;
  isAdmin?: boolean;
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
      return "bg-slate-100 text-slate-700 ring-slate-500/20";
  }
}

function MetricGrid({ cards }: { cards: MetricCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.id}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink-muted">{card.label}</h3>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ring-1 ring-inset ${toneClass(card.tone)}`}
            >
              {card.tag}
            </span>
          </div>
          <p className="text-4xl font-bold tracking-tight text-slate-deep">
            {card.value}
          </p>
        </article>
      ))}
    </div>
  );
}

export function DashboardMetrics({
  dictionary,
  metrics,
  welcomeName,
  isAdmin = false,
}: DashboardMetricsProps) {
  const m = dictionary.dashboard.metrics;
  const overview: MetricCard[] = [
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
    {
      id: "translate",
      label: m.translation,
      value: `${metrics.translationRate}%`,
      tag: m.translationTag,
      tone: "slate",
    },
  ];

  const admin = metrics.admin;

  return (
    <section
      id="dashboard"
      className="flex flex-col gap-8"
      aria-labelledby="home-dashboard-title"
    >
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
          {dictionary.dashboard.eyebrow}
        </p>
        <h2
          id="home-dashboard-title"
          className="text-balance text-2xl font-bold tracking-tight text-slate-deep sm:text-3xl"
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

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-deep">
          {dictionary.dashboard.sections?.overview ?? "Market overview"}
        </h3>
        <MetricGrid cards={overview} />
      </div>

      {isAdmin && admin ? (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-deep">
              {dictionary.dashboard.sections?.listings ?? "Listings"}
            </h3>
            <MetricGrid
              cards={[
                {
                  id: "pub",
                  label: m.listingsPublished,
                  value: String(admin.listingsPublished),
                  tag: m.listingsPublishedTag,
                  tone: "emerald",
                },
                {
                  id: "audit",
                  label: m.listingsPendingAudit,
                  value: String(admin.listingsPendingAudit),
                  tag: m.listingsPendingAuditTag,
                  tone: "amber",
                },
                {
                  id: "draft",
                  label: m.listingsDraft,
                  value: String(admin.listingsDraft),
                  tag: m.listingsDraftTag,
                  tone: "slate",
                },
                {
                  id: "ready",
                  label: m.listingsReady,
                  value: String(admin.listingsReady),
                  tag: m.listingsReadyTag,
                  tone: "gold",
                },
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
              ]}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-deep">
              {dictionary.dashboard.sections?.pageViews ?? "Page views"}
            </h3>
            <MetricGrid
              cards={[
                {
                  id: "pv-today",
                  label: m.pageViewsToday,
                  value: String(admin.pageViewsToday),
                  tag: m.pageViewsTodayTag,
                  tone: "sky",
                },
                {
                  id: "pv-week",
                  label: m.pageViewsWeek,
                  value: String(admin.pageViewsLast7Days),
                  tag: m.pageViewsWeekTag,
                  tone: "slate",
                },
              ]}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-deep">
              {dictionary.dashboard.sections?.push ?? "Push / SMS"}
            </h3>
            <MetricGrid
              cards={[
                {
                  id: "sms-pending",
                  label: m.smsPending,
                  value: String(admin.scrapeInvitesPending),
                  tag: m.smsPendingTag,
                  tone: "amber",
                },
                {
                  id: "sms-sent",
                  label: m.smsSent,
                  value: String(admin.smsSent),
                  tag: m.smsSentTag,
                  tone: "emerald",
                },
                {
                  id: "sms-failed",
                  label: m.smsFailed,
                  value: String(admin.smsFailed),
                  tag: m.smsFailedTag,
                  tone: "amber",
                },
              ]}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-deep">
              {dictionary.dashboard.sections?.version ?? "Version / deploy"}
            </h3>
            <MetricGrid
              cards={[
                {
                  id: "app-ver",
                  label: m.appVersion,
                  value: admin.version.appVersion,
                  tag: m.appVersionTag,
                  tone: "gold",
                },
                {
                  id: "commit",
                  label: m.commitSha,
                  value: admin.version.commitShort,
                  tag: m.commitShaTag,
                  tone: "slate",
                },
                {
                  id: "env",
                  label: m.deployEnv,
                  value: admin.version.environment,
                  tag: m.deployEnvTag,
                  tone: "sky",
                },
              ]}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
