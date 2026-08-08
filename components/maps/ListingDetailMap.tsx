"use client";

import { useEffect, useRef, useState } from "react";
import { ADDIS_MAP_ZOOM } from "@/lib/maps/addisSubcityCentroids";
import { loadGoogleMaps } from "@/lib/maps/loadGoogleMaps";

type MapStyle = Record<string, unknown>;

const LIGHT_MAP_STYLES: MapStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#e8eaed" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9d6e3" }],
  },
];

export function ListingDetailMap({
  lat,
  lng,
  approx,
  title,
  approxLabel,
  missingKeyLabel = "Map key not configured",
  errorLabel = "Map failed to load",
  className = "",
}: {
  lat: number;
  lng: number;
  approx: boolean;
  title?: string;
  approxLabel: string;
  missingKeyLabel?: string;
  errorLabel?: string;
  className?: string;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  useEffect(() => {
    if (!apiKey) {
      setStatus("missing");
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        await loadGoogleMaps(apiKey);
        const g = window.google?.maps;
        if (cancelled || !mapEl.current || !g?.Map) {
          if (!cancelled) setStatus("error");
          return;
        }

        const map = new g.Map(mapEl.current, {
          center: { lat, lng },
          zoom: approx ? ADDIS_MAP_ZOOM : 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
          styles: LIGHT_MAP_STYLES,
          backgroundColor: "#e8eaed",
        });

        if (g.Marker) {
          new g.Marker({
            map,
            position: { lat, lng },
            title: title ?? undefined,
          });
        }

        window.setTimeout(() => {
          if (!cancelled) g.event?.trigger(map, "resize");
        }, 120);

        setStatus("ready");
      } catch (err) {
        console.error("ListingDetailMap init failed", err);
        if (!cancelled) setStatus("error");
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [apiKey, lat, lng, approx, title]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-64">
        <div ref={mapEl} className="absolute inset-0 h-full w-full" />
        {status === "missing" || status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/95 px-4 text-center text-sm font-semibold text-slate-500">
            {status === "missing" ? missingKeyLabel : errorLabel}
          </div>
        ) : null}
      </div>
      {approx ? (
        <p className="text-xs text-slate-500">{approxLabel}</p>
      ) : null}
    </div>
  );
}
