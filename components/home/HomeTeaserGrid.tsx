import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import type { HomeTeaser } from "@/lib/catalog/home-teasers";
import type { Locale } from "@/lib/i18n/config";

function localized(
  value: Record<string, string> | null | undefined,
  locale: Locale,
): string {
  if (!value) return "";
  return value[locale] || value.en || value.am || Object.values(value)[0] || "";
}

function typeLabel(
  listingType: string,
  labels: { forSale: string; forRent: string; offPlan: string },
): string {
  if (listingType === "RENT") return labels.forRent;
  if (listingType === "OFF_PLAN") return labels.offPlan;
  return labels.forSale;
}

type HomeTeaserGridProps = {
  locale: Locale;
  teasers: HomeTeaser[];
  heading: string;
  emptyMessage: string;
  verifiedLabel: string;
  viewAllLabel: string;
  typeLabels: { forSale: string; forRent: string; offPlan: string };
};

export function HomeTeaserGrid({
  locale,
  teasers,
  heading,
  emptyMessage,
  verifiedLabel,
  viewAllLabel,
  typeLabels,
}: HomeTeaserGridProps) {
  const base = `/${locale}`;

  if (teasers.length === 0) {
    return (
      <section className="animate-rise-in space-y-3">
        <h2 className="text-xl font-bold tracking-tight text-slate-deep sm:text-2xl">
          {heading}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          {emptyMessage}
        </p>
      </section>
    );
  }

  return (
    <section className="animate-rise-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight text-slate-deep sm:text-2xl">
          {heading}
        </h2>
        <Link
          href={`${base}/listings`}
          className="text-sm font-semibold text-brand-800 transition hover:text-brand-700"
        >
          {viewAllLabel}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {teasers.map((teaser) => {
          const title = localized(teaser.title, locale);
          const place =
            localized(teaser.subCityName, locale) || teaser.subCityCode || "";
          return (
            <Link
              key={teaser.id}
              href={`${base}/listings/${teaser.id}`}
              className="group overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-obsidian">
                {teaser.imageUrl ? (
                  // Remote listing media hosts vary — native img avoids next/image allowlist gaps.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={teaser.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-obsidian to-slate-deep" />
                )}
                <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-brand-700 px-2.5 py-1 text-xs font-bold text-white">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {verifiedLabel}
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-deep/90 to-transparent px-3 pb-2.5 pt-8">
                  <p className="text-sm font-bold text-white">{teaser.priceBand}</p>
                </div>
              </div>
              <div className="space-y-2 p-3.5">
                <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-deep">
                  {title}
                </h3>
                {place ? (
                  <p className="flex items-center gap-1 text-xs text-ink-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{place}</span>
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-800">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {verifiedLabel}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-deep">
                    {typeLabel(teaser.listingType, typeLabels)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
