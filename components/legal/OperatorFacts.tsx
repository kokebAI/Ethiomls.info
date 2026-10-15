import { SITE_OPERATOR } from "@/lib/legal/operator";
import type { Dictionary } from "@/lib/i18n/getDictionary";

type OperatorFactsProps = {
  labels: Dictionary["legal"];
};

/** Registry block. Values are identifiers and stay in their registered form. */
export function OperatorFacts({ labels }: OperatorFactsProps) {
  const rows: Array<{ label: string; value: string; href?: string }> = [
    { label: labels.legalName, value: SITE_OPERATOR.legalName },
    { label: labels.tradeName, value: SITE_OPERATOR.tradeName },
    { label: labels.tin, value: SITE_OPERATOR.tin },
    { label: labels.license, value: SITE_OPERATOR.businessLicense },
    { label: labels.tradeReg, value: SITE_OPERATOR.tradeNameRegistration },
    { label: labels.address, value: SITE_OPERATOR.address },
    {
      label: labels.phone,
      value: SITE_OPERATOR.phoneDisplay,
      href: `tel:${SITE_OPERATOR.phoneTel}`,
    },
  ];

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-sm font-semibold text-slate-deep">{row.label}</dt>
          <dd className="mt-1 text-pretty text-sm leading-relaxed text-ink">
            {row.href ? (
              <a
                href={row.href}
                className="underline decoration-slate-300 underline-offset-4 hover:decoration-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              >
                {row.value}
              </a>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
