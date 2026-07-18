"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

type ListingGalleryProps = {
  photos: string[];
  title: string;
};

/** MLS-style photo gallery: large hero photo + clickable thumbnail strip. */
export function ListingGallery({ photos, title }: ListingGalleryProps) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
        <ImageIcon className="h-10 w-10" aria-hidden="true" />
      </div>
    );
  }

  const show = (index: number) =>
    setActive((index + photos.length) % photos.length);

  return (
    <div className="space-y-3">
      <div className="group relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-[var(--shadow-card)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote listing photos */}
        <img
          src={photos[active]}
          alt={`${title} — ${active + 1}/${photos.length}`}
          className="h-full w-full object-cover"
        />
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-800 shadow-md backdrop-blur transition hover:bg-white"
              onClick={() => show(active - 1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-800 shadow-md backdrop-blur transition hover:bg-white"
              onClick={() => show(active + 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              {active + 1} / {photos.length}
            </span>
          </>
        ) : null}
      </div>

      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              aria-label={`Photo ${index + 1}`}
              aria-current={index === active}
              className={`relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl border-2 transition sm:w-28 ${
                index === active
                  ? "border-emerald-500"
                  : "border-transparent opacity-75 hover:opacity-100"
              }`}
              onClick={() => setActive(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote listing photos */}
              <img
                src={url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
