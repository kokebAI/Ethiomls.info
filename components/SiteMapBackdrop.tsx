"use client";

import { AddisSkylineBackdrop } from "@/components/AddisSkylineBackdrop";
import {
  DarkMapBackground,
  hasGoogleMapsApiKey,
} from "@/components/DarkMapBackground";

type SiteMapBackdropProps = {
  /** Light pages use a subtle wash; dark pages (login) show more contrast. */
  variant?: "light" | "dark";
  className?: string;
};

/**
 * Prefers the CRM-style Google Maps wash when a key is configured;
 * falls back to the SVG Addis skyline otherwise.
 */
export function SiteMapBackdrop({
  variant = "light",
  className = "",
}: SiteMapBackdropProps) {
  if (!hasGoogleMapsApiKey()) {
    return (
      <AddisSkylineBackdrop variant={variant} className={className} />
    );
  }

  const isDark = variant === "dark";
  const positionClass = isDark
    ? "absolute inset-0"
    : "fixed inset-0 z-0";

  return (
    <DarkMapBackground
      forceTheme={isDark ? "dark" : "light"}
      className={`${positionClass} ${className}`}
      overlayClassName={
        isDark
          ? "bg-slate-950/70"
          : "bg-gradient-to-b from-white/85 via-white/80 to-white/90"
      }
    />
  );
}
