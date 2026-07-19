type BarSegment = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type FunnelStep = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type SeriesPoint = {
  day: string;
  pageViews: number;
};

function dayLabel(isoDay: string): string {
  const [, month, day] = isoDay.split("-");
  return `${month}/${day}`;
}

/** Horizontal proportional bars for listing / status mix. */
export function StatusBarChart({
  title,
  segments,
  emptyLabel,
}: {
  title: string;
  segments: BarSegment[];
  emptyLabel: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-semibold text-slate-deep">{title}</h3>
      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {segments.map((segment) => {
            const pct = Math.max(2, Math.round((segment.value / total) * 100));
            return (
              <li key={segment.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-700">
                    {segment.label}
                  </span>
                  <span className="tabular-nums font-semibold text-slate-deep">
                    {segment.value}
                    <span className="ml-1 font-normal text-slate-400">
                      ({Math.round((segment.value / total) * 100)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${pct}%`, backgroundColor: segment.color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

/** Step funnel with shrinking bars. */
export function FunnelChart({
  title,
  steps,
  emptyLabel,
}: {
  title: string;
  steps: FunnelStep[];
  emptyLabel: string;
}) {
  const max = Math.max(...steps.map((s) => s.value), 0);

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-semibold text-slate-deep">{title}</h3>
      {max === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {steps.map((step) => {
            const width = Math.max(18, Math.round((step.value / max) * 100));
            return (
              <li key={step.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-medium text-slate-600 sm:w-24">
                  {step.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="flex h-8 items-center rounded-lg px-2.5 text-xs font-bold tabular-nums text-white shadow-sm"
                    style={{
                      width: `${width}%`,
                      backgroundColor: step.color,
                    }}
                  >
                    {step.value}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

/** 7-day page-view area/line chart in pure SVG. */
export function PageViewsTrendChart({
  title,
  series,
  todayLabel,
  weekLabel,
  todayValue,
  weekValue,
  emptyLabel,
}: {
  title: string;
  series: SeriesPoint[];
  todayLabel: string;
  weekLabel: string;
  todayValue: number;
  weekValue: number;
  emptyLabel: string;
}) {
  const width = 320;
  const height = 120;
  const padX = 8;
  const padY = 12;
  const max = Math.max(...series.map((p) => p.pageViews), 1);
  const points = series.map((point, index) => {
    const x =
      padX +
      (series.length <= 1
        ? width / 2
        : (index / (series.length - 1)) * (width - padX * 2));
    const y =
      height -
      padY -
      (point.pageViews / max) * (height - padY * 2);
    return { ...point, x, y };
  });
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area =
    points.length > 0
      ? `M ${points[0].x},${height - padY} L ${line.replace(/ /g, " L ")} L ${points[points.length - 1].x},${height - padY} Z`
      : "";

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-deep">{title}</h3>
        <div className="flex gap-3 text-xs">
          <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold tabular-nums text-sky-800 ring-1 ring-inset ring-sky-600/15">
            {todayLabel}: {todayValue}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold tabular-nums text-slate-700 ring-1 ring-inset ring-slate-500/15">
            {weekLabel}: {weekValue}
          </span>
        </div>
      </div>
      {weekValue === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-muted">{emptyLabel}</p>
      ) : (
        <div className="mt-3">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-36 w-full"
            role="img"
            aria-label={title}
          >
            <defs>
              <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((ratio) => {
              const y = height - padY - ratio * (height - padY * 2);
              return (
                <line
                  key={ratio}
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
              );
            })}
            <path d={area} fill="url(#pvFill)" />
            <polyline
              points={line}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point) => (
              <circle
                key={point.day}
                cx={point.x}
                cy={point.y}
                r="3.5"
                fill="#fff"
                stroke="#0284c7"
                strokeWidth="2"
              />
            ))}
          </svg>
          <div className="mt-1 flex justify-between px-1 text-[0.65rem] font-medium text-slate-400">
            {points.map((point) => (
              <span key={point.day} className="tabular-nums">
                {dayLabel(point.day)}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

/** Compact translation coverage meter. */
export function TranslationMeter({
  label,
  percent,
  tag,
}: {
  label: string;
  percent: number;
  tag: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-deep">{label}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-500/15">
          {tag}
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-deep">
        {clamped}%
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </article>
  );
}
