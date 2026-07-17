import Link from "next/link";
import type { RoleHubDef, RoleHubSlug } from "@/lib/roles/hubs";
import { ROLE_HUB_SLUGS } from "@/lib/roles/hubs";
import { PageIntro } from "@/components/PageIntro";
import type { Dictionary } from "@/lib/i18n/getDictionary";

type RoleHubViewProps = {
  locale: string;
  hub: RoleHubDef;
  dictionary: Dictionary;
  t: (key: string) => string;
};

export function RoleHubView({ locale, hub, dictionary, t }: RoleHubViewProps) {
  const copy = dictionary.roles[hub.slug];
  const base = `/${locale}`;

  return (
    <PageIntro
      eyebrow={copy.eyebrow}
      title={copy.title}
      lede={copy.lede}
      motto={dictionary.brand.motto}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {hub.ctas.map((cta) => {
            const label =
              (copy.ctas as Record<string, string>)[cta.id] ?? cta.id;
            const href = `${base}${cta.href}`;
            if (cta.primary) {
              return (
                <Link
                  key={cta.id}
                  href={href}
                  className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                >
                  {label}
                </Link>
              );
            }
            return (
              <Link
                key={cta.id}
                href={href}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
              >
                {label}
              </Link>
            );
          })}
        </div>

        <nav
          className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-[var(--shadow-card)] sm:p-5"
          aria-label={t("roles.switchLabel")}
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t("roles.switchLabel")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {ROLE_HUB_SLUGS.map((slug: RoleHubSlug) => {
              const active = slug === hub.slug;
              const chip = dictionary.roles[slug];
              return (
                <li key={slug}>
                  <Link
                    href={`${base}/roles/${slug}`}
                    className={`inline-flex rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                      active
                        ? "bg-slate-deep text-white"
                        : "border border-slate-200 bg-white text-ink hover:bg-slate-50"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {chip.eyebrow}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </PageIntro>
  );
}
