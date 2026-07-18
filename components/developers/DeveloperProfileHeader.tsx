import Link from "next/link";
import { ExternalLink, MapPin, ShieldCheck } from "lucide-react";

export type DeveloperFact = {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
  kind?: "hq" | "default";
};

type DeveloperProfileHeaderProps = {
  name: string;
  tradeName?: string | null;
  verified: boolean;
  verifiedLabel: string;
  facts: DeveloperFact[];
  badges: Array<{ label: string; tone: "amber" | "emerald" | "violet" | "slate" }>;
};

const badgeTone: Record<
  DeveloperProfileHeaderProps["badges"][number]["tone"],
  string
> = {
  amber: "bg-amber-50 text-amber-800 ring-amber-600/15",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
  violet: "bg-violet-50 text-violet-800 ring-violet-600/15",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/15",
};

/**
 * Trust-first developer profile chrome: name, verified state, credential facts,
 * and inventory/project count badges.
 */
export function DeveloperProfileHeader({
  name,
  tradeName,
  verified,
  verifiedLabel,
  facts,
  badges,
}: DeveloperProfileHeaderProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {tradeName && tradeName !== name ? (
          <p className="text-sm font-medium text-slate-500">{tradeName}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 ring-1 ring-amber-600/15 ring-inset">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {verifiedLabel}
            </span>
          ) : null}
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${badgeTone[badge.tone]}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      {facts.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div
              key={`${fact.label}:${fact.value}`}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {fact.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {fact.href ? (
                  <Link
                    href={fact.href}
                    {...(fact.external
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                    className="inline-flex items-center gap-1.5 text-emerald-800 underline-offset-2 hover:underline"
                  >
                    {fact.kind === "hq" ? (
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : null}
                    <span>{fact.value}</span>
                    {fact.external ? (
                      <ExternalLink
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : null}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {fact.kind === "hq" ? (
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    ) : null}
                    {fact.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

