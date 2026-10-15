import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/getDictionary";
import { operatorFooterLine } from "@/lib/legal/operator";

type SiteFooterProps = {
  locale: Locale;
  dictionary: Dictionary;
};

/** Operator identification on every locale page. */
export function SiteFooter({ locale, dictionary }: SiteFooterProps) {
  const copy = dictionary.legal;
  const base = `/${locale}`;

  return (
    <footer className="relative z-10 mt-auto border-t border-slate-200/90 bg-white/90">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:px-6">
        <p className="text-pretty text-sm leading-relaxed text-ink">
          {operatorFooterLine()}
        </p>
        <nav aria-label={copy.navLabel} className="flex flex-wrap gap-x-4 gap-y-2">
          <Link
            href={`${base}/about`}
            className="text-sm font-semibold text-slate-deep underline decoration-slate-300 underline-offset-4 hover:decoration-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            {copy.about}
          </Link>
          <Link
            href={`${base}/terms`}
            className="text-sm font-semibold text-slate-deep underline decoration-slate-300 underline-offset-4 hover:decoration-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            {copy.terms}
          </Link>
          <Link
            href={`${base}/privacy`}
            className="text-sm font-semibold text-slate-deep underline decoration-slate-300 underline-offset-4 hover:decoration-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            {copy.privacy}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
