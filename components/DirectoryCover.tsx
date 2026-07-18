"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

type DirectoryCoverProps = {
  imageUrl?: string | null;
  photoCount?: number;
  placeholderLabel?: string;
};

/** Cover photo for directory cards; falls back to a placeholder when missing or broken. */
export function DirectoryCover({
  imageUrl,
  photoCount,
  placeholderLabel = "Photo coming soon",
}: DirectoryCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/40">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote listing photos from arbitrary hosts
        <img
          src={imageUrl!}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 text-slate-400"
          role="img"
          aria-label={placeholderLabel}
        >
          <ImageIcon className="h-7 w-7 opacity-70" aria-hidden="true" />
          <span className="text-center text-[0.7rem] font-medium tracking-wide text-slate-500">
            {placeholderLabel}
          </span>
        </div>
      )}
      {showImage && photoCount && photoCount > 1 ? (
        <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          +{photoCount - 1}
        </span>
      ) : null}
    </div>
  );
}
