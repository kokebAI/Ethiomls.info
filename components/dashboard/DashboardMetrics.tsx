import type { DashboardMetricsData } from "@/lib/catalog/dashboard-metrics";
import type { Dictionary } from "@/lib/i18n/getDictionary";
import { translate } from "@/lib/i18n/getDictionary";

type DashboardMetricsProps = {
  dictionary: Dictionary;
  metrics: DashboardMetricsData;
  welcomeName?: string | null;
};

export function DashboardMetrics({
  dictionary,
  metrics,
  welcomeName,
}: DashboardMetricsProps) {
  const cards = [
    {
      id: "active",
      label: translate(dictionary, "dashboard.metrics.active"),
      value: String(metrics.activeListings),
      tag: translate(dictionary, "dashboard.metrics.activeTag"),
      tone: "gold" as const,
    },
    {
      id: "pending",
      label: translate(dictionary, "dashboard.metrics.pending"),
      value: String(metrics.pendingApprovals),
      tag: translate(dictionary, "dashboard.metrics.pendingTag"),
      tone: "amber" as const,
    },
    {
      id: "translate",
      label: translate(dictionary, "dashboard.metrics.translation"),
      value: `${metrics.translationRate}%`,
      tag: translate(dictionary, "dashboard.metrics.translationTag"),
      tone: "slate" as const,
    },
  ];

  return (
    <section
      id="dashboard"
      className="flex flex-col gap-5"
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
          {dictionary.dashboard.lede}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.id}
            className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink-muted">{card.label}</h3>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ring-1 ring-inset ${
                  card.tone === "gold"
                    ? "bg-brand-50 text-brand-800 ring-brand-600/20"
                    : card.tone === "amber"
                      ? "bg-amber-50 text-amber-800 ring-amber-600/20"
                      : "bg-slate-100 text-slate-700 ring-slate-500/20"
                }`}
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
    </section>
  );
}
