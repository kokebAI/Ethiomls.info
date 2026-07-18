"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type ShareListingButtonProps = {
  url: string;
  title: string;
  text?: string;
  className?: string;
};

/**
 * Share listing from the web: WhatsApp, Telegram, email, copy link,
 * plus the native share sheet when the browser supports it.
 */
export function ShareListingButton({
  url,
  title,
  text,
  className = "",
}: ShareListingButtonProps) {
  const { t } = useTranslation();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const blurb = text || title;

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: blurb, url });
      setOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyLink();
    }
  }

  function openWhatsApp() {
    const message = `${blurb}\n${url}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setOpen(false);
  }

  function openTelegram() {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(blurb)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setOpen(false);
  }

  function openEmail() {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${blurb}\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setOpen(false);
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-emerald-50 hover:text-emerald-900";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 lg:w-auto"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {t("listingDetail.share")}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t("listingDetail.shareMenu")}
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-slate-950/5"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={openWhatsApp}
          >
            <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {t("listingDetail.shareWhatsApp")}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={openTelegram}
          >
            <MessageCircle className="h-4 w-4 text-sky-600" aria-hidden="true" />
            {t("listingDetail.shareTelegram")}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={openEmail}
          >
            <Mail className="h-4 w-4 text-slate-500" aria-hidden="true" />
            {t("listingDetail.shareEmail")}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => void copyLink()}
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4 text-slate-500" aria-hidden="true" />
            )}
            {copied
              ? t("listingDetail.shareCopied")
              : t("listingDetail.shareCopy")}
          </button>
          {canNativeShare ? (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => void nativeShare()}
            >
              <Share2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
              {t("listingDetail.shareMore")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
