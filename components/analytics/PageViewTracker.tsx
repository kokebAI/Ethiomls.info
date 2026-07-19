"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fires one page-view beacon per pathname visit (session-deduped per hour).
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    // Skip noisy internal / assets paths if they ever hit the app router.
    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname.includes(".")
    ) {
      return;
    }

    const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
    const key = `emls_pv:${pathname}:${hourBucket}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // private mode / blocked storage — still count once this mount
    }

    const controller = new AbortController();
    void fetch("/api/analytics/pageview", {
      method: "POST",
      keepalive: true,
      signal: controller.signal,
    }).catch(() => {
      /* ignore network failures */
    });

    return () => controller.abort();
  }, [pathname]);

  return null;
}
