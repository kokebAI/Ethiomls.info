"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type ShareListingButtonProps = {
  url: string;
  title: string;
  text?: string;
  className?: string;
};

/**
 * Share listing link with friends/family.
 * Uses the Web Share API when available; otherwise copies the URL.
 */
export function ShareListingButton({
  url,
  title,
  text,
  className = "",
}: ShareListingButtonProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "copied" | "shared">("idle");

  async function share() {
    const shareData = {
      title,
      text: text || title,
      url,
    };

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare(shareData))
      ) {
        await navigator.share(shareData);
        setStatus("shared");
        window.setTimeout(() => setStatus("idle"), 2000);
        return;
      }

      await navigator.clipboard.writeText(url);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch (error) {
      // User cancelled the share sheet — ignore AbortError.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
        window.setTimeout(() => setStatus("idle"), 2500);
      } catch {
        setStatus("idle");
      }
    }
  }

  const label =
    status === "copied"
      ? t("listingDetail.shareCopied")
      : status === "shared"
        ? t("listingDetail.shareDone")
        : t("listingDetail.share");

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 ${className}`}
      aria-live="polite"
    >
      {status === "copied" || status === "shared" ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <Share2 className="h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
