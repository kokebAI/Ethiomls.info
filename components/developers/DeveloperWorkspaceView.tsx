import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { PageDirectory, type DirectoryItem } from "@/components/PageDirectory";
import {
  DEVELOPER_OFFPLAN_EVIDENCE_KINDS,
  EVIDENCE_KIND_LABELS,
  MIN_GALLERY_PHOTOS,
} from "@/lib/properties/evidence";

export type DeveloperWorkspaceCopy = {
  eyebrow: string;
  title: string;
  lede: string;
  motto?: string;
  addInventory: string;
  viewProjects: string;
  myPage: string;
  accountProfile: string;
  readinessTitle: string;
  readinessProfileOk: string;
  readinessProfileNeeded: string;
  readinessFaydaOk: string;
  readinessFaydaNeeded: string;
  readinessPending: string;
  packTitle: string;
  packLede: string;
  packPhotos: string;
  packFayda: string;
  packCta: string;
  pendingTitle: string;
  pendingEmpty: string;
  publishedTitle: string;
  publishedEmpty: string;
};

export type DeveloperWorkspaceProps = {
  locale: string;
  copy: DeveloperWorkspaceCopy;
  tradeName: string | null;
  developerId: string | null;
  hasFayda: boolean;
  pendingItems: DirectoryItem[];
  publishedItems: DirectoryItem[];
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        ok ? "bg-emerald-500" : "bg-amber-500"
      }`}
      aria-hidden
    />
  );
}

export function DeveloperWorkspaceView({
  locale,
  copy,
  tradeName,
  developerId,
  hasFayda,
  pendingItems,
  publishedItems,
}: DeveloperWorkspaceProps) {
  const base = `/${locale}`;
  const myPageHref = developerId
    ? `${base}/developers/${developerId}`
    : `${base}/developers`;

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title}
        lede={copy.lede}
        motto={copy.motto}
      >
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={`${base}/listings/new?type=OFF_PLAN`}
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              {copy.addInventory}
            </Link>
            <Link
              href={myPageHref}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
            >
              {copy.myPage}
            </Link>
            <Link
              href={`${base}/profile`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
            >
              {copy.accountProfile}
            </Link>
          </div>

          <section
            className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] sm:p-6"
            aria-labelledby="dev-readiness-heading"
          >
            <h2
              id="dev-readiness-heading"
              className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500"
            >
              {copy.readinessTitle}
            </h2>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-3 text-sm text-ink">
                <StatusDot ok={Boolean(developerId)} />
                <span>
                  {developerId
                    ? copy.readinessProfileOk.replace(
                        "{name}",
                        tradeName || "—",
                      )
                    : copy.readinessProfileNeeded}
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm text-ink">
                <StatusDot ok={hasFayda} />
                <span>
                  {hasFayda ? copy.readinessFaydaOk : copy.readinessFaydaNeeded}
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm text-ink">
                <StatusDot ok={pendingItems.length === 0} />
                <span>
                  {copy.readinessPending.replace(
                    "{count}",
                    String(pendingItems.length),
                  )}
                </span>
              </li>
            </ul>
          </section>

          <section
            className="rounded-2xl border border-slate-200/90 bg-slate-deep px-5 py-6 text-white shadow-[var(--shadow-card)] sm:px-7 sm:py-7"
            aria-labelledby="dev-pack-heading"
          >
            <h2
              id="dev-pack-heading"
              className="text-lg font-semibold tracking-tight sm:text-xl"
            >
              {copy.packTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              {copy.packLede}
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {DEVELOPER_OFFPLAN_EVIDENCE_KINDS.map((kind) => (
                <li
                  key={kind}
                  className="flex items-center gap-2 text-sm text-slate-200"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {EVIDENCE_KIND_LABELS[kind]}
                </li>
              ))}
              <li className="flex items-center gap-2 text-sm text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {copy.packPhotos.replace("{min}", String(MIN_GALLERY_PHOTOS))}
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {copy.packFayda}
              </li>
            </ul>
            <Link
              href={`${base}/listings/new?type=OFF_PLAN`}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              {copy.packCta}
            </Link>
          </section>

          <section className="space-y-4" aria-labelledby="dev-pending-heading">
            <h2
              id="dev-pending-heading"
              className="text-lg font-semibold tracking-tight text-slate-deep"
            >
              {copy.pendingTitle}
            </h2>
            <PageDirectory
              items={pendingItems}
              emptyMessage={copy.pendingEmpty}
              layout="list"
            />
          </section>

          <section className="space-y-4" aria-labelledby="dev-published-heading">
            <h2
              id="dev-published-heading"
              className="text-lg font-semibold tracking-tight text-slate-deep"
            >
              {copy.publishedTitle}
            </h2>
            <PageDirectory
              items={publishedItems}
              emptyMessage={copy.publishedEmpty}
              layout="grid"
            />
          </section>
        </div>
      </PageIntro>
    </div>
  );
}
