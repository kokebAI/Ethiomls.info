"use client";

import { useEffect } from "react";

/**
 * Registers the EthioMLS service worker so Chromium can qualify the app
 * for offline caching and Add to Home Screen / install prompts.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("[pwa] service worker registration failed:", error);
      }
    };

    void register();
  }, []);

  return null;
}
