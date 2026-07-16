import { PageDirectory, type DirectoryBadge } from "@/components/PageDirectory";
import { PageIntro } from "@/components/PageIntro";
import { fetchVerifiedDevelopers } from "@/lib/catalog/queries";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

export default async function DevelopersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const developers = await fetchVerifiedDevelopers();

  const items = developers.map((developer) => {
    const hq = developer.headquartersSubCity
      ? pickLocalized(developer.headquartersSubCity.name, locale) ||
        developer.headquartersSubCity.code
      : "—";

    const badges: DirectoryBadge[] = developer.isVerified
      ? [{ label: translate(dictionary, "common.verified"), tone: "amber" }]
      : [];

    return {
      id: developer.id,
      title:
        pickLocalized(developer.displayName, locale) || developer.tradeName,
      meta: [hq].filter(Boolean).join(" · "),
      badges,
    };
  });

  return (
    <PageIntro
      eyebrow={dictionary.brand.name}
      title={dictionary.pages.developers.title}
      lede={dictionary.pages.developers.lede}
      motto={dictionary.brand.motto}
    >
      {items.length > 0 ? (
        <p
          className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 ring-1 ring-emerald-600/15 ring-inset"
          role="status"
        >
          {translate(dictionary, "pages.recordCount", { count: items.length })}
        </p>
      ) : null}
      <PageDirectory
        items={items}
        emptyMessage={translate(dictionary, "pages.emptyDirectory")}
        layout="grid"
      />
    </PageIntro>
  );
}
