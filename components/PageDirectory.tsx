import type { ReactNode } from "react";
import Link from "next/link";
import { DirectoryCover } from "@/components/DirectoryCover";

export type DirectoryBadge = {
  label: string;
  tone?: "emerald" | "sky" | "violet" | "amber" | "slate";
};

export type DirectoryItem = {
  id: string;
  title: string;
  meta: string;
  badges?: DirectoryBadge[];
  footer?: ReactNode;
  /** When set, the card title (and card surface) link to this href. */
  href?: string;
  /** Cover photo shown at the top of the card. */
  imageUrl?: string | null;
  /** Extra photo count shown as a "+N" chip over the cover photo. */
  photoCount?: number;
};

type PageDirectoryProps = {
  items: DirectoryItem[];
  emptyMessage: string;
  layout?: "grid" | "list";
  /** Label when a card has no usable cover photo. */
  imagePlaceholder?: string;
};

const BADGE_TONES: Record<NonNullable<DirectoryBadge["tone"]>, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/15",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/15",
};

export function PageDirectory({
  items,
  emptyMessage,
  layout = "grid",
  imagePlaceholder,
}: PageDirectoryProps) {
  if (items.length === 0) {
    return (
      <p
        className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-sm leading-relaxed text-slate-600"
        role="status"
      >
        {emptyMessage}
      </p>
    );
  }

  const gridClass =
    layout === "grid"
      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      : "flex flex-col gap-3";

  return (
    <ul className={`${gridClass} list-none p-0 m-0`}>
      {items.map((item) => {
        const cardClass =
          "group overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[var(--shadow-card-hover)]";
        const body = (
          <>
            <DirectoryCover
              imageUrl={item.imageUrl}
              photoCount={item.photoCount}
              placeholderLabel={imagePlaceholder}
            />
            <div className="p-5">
            {item.badges && item.badges.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {item.badges.map((badge) => (
                  <span
                    key={`${item.id}-${badge.label}`}
                    className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold leading-snug ring-1 ring-inset ${
                      BADGE_TONES[badge.tone ?? "slate"]
                    }`}
                  >
                    <span className="truncate">{badge.label}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <h2 className="text-balance text-lg font-semibold leading-snug text-slate-900 group-hover:text-emerald-900">
              {item.title}
            </h2>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-600">
              {item.meta}
            </p>
            {item.footer ? <div className="mt-3">{item.footer}</div> : null}
            </div>
          </>
        );

        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className={`block ${cardClass}`}>
                {body}
              </Link>
            ) : (
              <div className={cardClass}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
