import type { ReactNode } from "react";
import Link from "next/link";
import { DirectoryCover } from "@/components/DirectoryCover";

export type DirectoryBadge = {
  label: string;
  tone?: "brand" | "emerald" | "sky" | "violet" | "amber" | "slate";
};

export type DirectoryItem = {
  id: string;
  title: string;
  meta: string;
  badges?: DirectoryBadge[];
  footer?: ReactNode;
  /** When set, the card title (and card surface) link to this href. */
  href?: string;
  /** Cover photo shown in the middle of the card. */
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
  brand: "bg-brand-50 text-brand-800 ring-brand-600/15",
  emerald: "bg-brand-50 text-brand-800 ring-brand-600/15",
  sky: "bg-slate-100 text-slate-700 ring-slate-500/15",
  violet: "bg-slate-obsidian/10 text-slate-deep ring-slate-deep/15",
  amber: "bg-brand-50 text-brand-800 ring-brand-600/15",
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
        className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-8 text-center text-sm leading-relaxed text-ink-muted"
        role="status"
      >
        {emptyMessage}
      </p>
    );
  }

  const gridClass =
    layout === "grid"
      ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      : "flex flex-col gap-3";

  return (
    <ul className={`${gridClass} m-0 list-none p-0`}>
      {items.map((item) => {
        const cardClass =
          "group overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-[var(--shadow-card-hover)]";
        const body = (
          <>
            <div className="space-y-2 px-3 pt-3 sm:px-4 sm:pt-4">
              {item.badges && item.badges.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {item.badges.map((badge) => (
                    <span
                      key={`${item.id}-${badge.label}`}
                      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-semibold leading-snug ring-1 ring-inset ${
                        BADGE_TONES[badge.tone ?? "slate"]
                      }`}
                    >
                      <span className="truncate">{badge.label}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              <h2 className="line-clamp-2 text-balance text-base font-bold leading-snug text-slate-deep group-hover:text-brand-700">
                {item.title}
              </h2>
            </div>

            <div className="mt-3">
              <DirectoryCover
                imageUrl={item.imageUrl}
                photoCount={item.photoCount}
                placeholderLabel={imagePlaceholder}
              />
            </div>

            <div className="space-y-2 px-3 py-3 sm:px-4 sm:py-4">
              <p className="line-clamp-3 text-pretty text-sm leading-relaxed text-ink-muted">
                {item.meta}
              </p>
              {item.footer ? <div>{item.footer}</div> : null}
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
