import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/getDictionary";
import type { LegalSection } from "@/lib/legal/documents";

type LegalProseProps = {
  locale: Locale;
  copy: Dictionary["legal"];
  sections: LegalSection[];
};

export function LegalProse({ locale, copy, sections }: LegalProseProps) {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <p
        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
        role="note"
      >
        {copy.templateBanner}
      </p>
      {locale !== "en" ? (
        <p className="text-pretty text-sm leading-relaxed text-ink" role="note">
          {copy.pendingTranslation}
        </p>
      ) : null}
      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-3" aria-labelledby={section.id}>
          <h2
            id={section.id}
            className="text-balance text-xl font-bold tracking-tight text-slate-deep"
          >
            {section.title}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-pretty text-sm leading-relaxed text-ink sm:text-base">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
