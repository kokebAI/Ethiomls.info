"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

type ListingGalleryProps = {
  photos: string[];
  title: string;
  emptyLabel?: string;
};

/** MLS-style photo gallery: large hero photo + clickable thumbnail strip. */
export function ListingGallery({
  photos,
  title,
  emptyLabel = "Photo coming soon",
}: ListingGalleryProps) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const usableIndexes = useMemo(
    () => photos.map((_, index) => index).filter((index) => !failed[index]),
    [photos, failed],
  );

  if (photos.length === 0 || usableIndexes.length === 0) {
    return (
      <div
        className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 text-slate-400"
        role="img"
        aria-label={emptyLabel}
      >
        <ImageIcon className="h-10 w-10 opacity-70" aria-hidden="true" />
        <span className="text-sm font-medium text-slate-500">{emptyLabel}</span>
      </div>
    );
  }

  const safeActive = usableIndexes.includes(active)
    ? active
    : usableIndexes[0];
  const show = (index: number) =>
    setActive(usableIndexes[(usableIndexes.indexOf(safeActive) + index + usableIndexes.length) % usableIndexes.length] ?? usableIndexes[0]);

  return (
    <div className="space-y-3">
      <div className="group relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-[var(--shadow-card)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote listing photos */}
        <img
          src={photos[safeActive]}
          alt={`${title} — ${usableIndexes.indexOf(safeActive) + 1}/${usableIndexes.length}`}
          className="h-full w-full object-cover"
          onError={() =>
            setFailed((prev) => ({ ...prev, [safeActive]: true }))
          }
        />
        {usableIndexes.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-800 shadow-md backdrop-blur transition hover:bg-white"
              onClick={() => show(-1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-800 shadow-md backdrop-blur transition hover:bg-white"
              onClick={() => show(1)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              {usableIndexes.indexOf(safeActive) + 1} / {usableIndexes.length}
            </span>
          </>
        ) : null}
      </div>

      {usableIndexes.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {usableIndexes.map((index) => (
            <button
              key={`${photos[index]}-${index}`}
              type="button"
              aria-label={`Photo ${usableIndexes.indexOf(index) + 1}`}
              aria-current={index === safeActive}
              className={`relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl border-2 transition sm:w-28 ${
                index === safeActive
                  ? "border-emerald-500"
                  : "border-transparent opacity-75 hover:opacity-100"
              }`}
              onClick={() => setActive(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote listing photos */}
              <img
                src={photos[index]}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={() =>
                  setFailed((prev) => ({ ...prev, [index]: true }))
                }
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
