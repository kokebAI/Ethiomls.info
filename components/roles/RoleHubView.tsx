import Link from "next/link";
import type { RoleHubDef } from "@/lib/roles/hubs";
import { PageIntro } from "@/components/PageIntro";
import type { Dictionary } from "@/lib/i18n/getDictionary";

type RoleHubViewProps = {
  locale: string;
  hub: RoleHubDef;
  dictionary: Dictionary;
};

export function RoleHubView({ locale, hub, dictionary }: RoleHubViewProps) {
  const copy = dictionary.roles[hub.slug];
  const base = `/${locale}`;

  return (
    <PageIntro
      eyebrow={copy.eyebrow}
      title={copy.title}
      lede={copy.lede}
      motto={dictionary.brand.motto}
    >
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
    </PageIntro>
  );
}
