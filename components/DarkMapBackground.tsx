"use client";

import { useEffect, useRef, useState } from "react";
import {
  ADDIS_MAP_CENTER,
  ADDIS_MAP_ZOOM,
} from "@/lib/maps/addisSubcityCentroids";
import { loadGoogleMaps } from "@/lib/maps/loadGoogleMaps";

type MapStyle = Record<string, unknown>;

const DARK_MAP_STYLES: MapStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1A1A1A" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a5a5a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1A1A1A" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.neighborhood",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2C2C2C" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f1f1f" }],
  },
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#333333" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0d0d10" }],
  },
  {
    featureType: "water",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

const LIGHT_MAP_STYLES: MapStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#e8eaed" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#e8eaed" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.neighborhood",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d5d8dd" }],
  },
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dadce0" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9d6e3" }],
  },
  {
    featureType: "water",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

type GoogleMap = {
  setOptions?: (o: Record<string, unknown>) => void;
  setCenter?: (c: { lat: number; lng: number }) => void;
};

function readTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

type DarkMapBackgroundProps = {
  className?: string;
  overlayClassName?: string;
  /** Force map style regardless of data-theme (login uses dark). */
  forceTheme?: "light" | "dark";
};

export function DarkMapBackground({
  className = "",
  overlayClassName = "bg-white/75",
  forceTheme,
}: DarkMapBackgroundProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(forceTheme ?? "light");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  useEffect(() => {
    if (forceTheme) {
      setTheme(forceTheme);
      return;
    }
    setTheme(readTheme());
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, [forceTheme]);

  useEffect(() => {
    if (!apiKey) {
      setShowFallback(true);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !el.current || !window.google?.maps?.Map) {
          if (!cancelled) setShowFallback(true);
          return;
        }

        const styles = theme === "dark" ? DARK_MAP_STYLES : LIGHT_MAP_STYLES;
        const bg = theme === "dark" ? "#0F0F11" : "#e8eaed";

        if (mapRef.current?.setOptions) {
          mapRef.current.setOptions({ styles, backgroundColor: bg });
          window.google.maps.event?.trigger(mapRef.current, "resize");
          setShowFallback(false);
          return;
        }

        mapRef.current = new window.google.maps.Map(el.current, {
          center: { lat: ADDIS_MAP_CENTER.lat, lng: ADDIS_MAP_CENTER.lng },
          zoom: ADDIS_MAP_ZOOM,
          disableDefaultUI: true,
          gestureHandling: "none",
          keyboardShortcuts: false,
          clickableIcons: false,
          styles,
          backgroundColor: bg,
        }) as GoogleMap;

        window.setTimeout(() => {
          if (!cancelled && mapRef.current) {
            window.google?.maps.event?.trigger(mapRef.current, "resize");
            mapRef.current.setCenter?.({
              lat: ADDIS_MAP_CENTER.lat,
              lng: ADDIS_MAP_CENTER.lng,
            });
          }
        }, 120);

        setShowFallback(false);
      } catch (err) {
        console.error("DarkMapBackground init failed", err);
        if (!cancelled) setShowFallback(true);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [apiKey, theme]);

  const fallbackBg = theme === "dark" ? "#0F0F11" : "#eef0f4";
  const grid = theme === "dark" ? "rgba(44,44,44,0.35)" : "rgba(0,0,0,0.06)";

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <div ref={el} className="absolute inset-0 h-full w-full min-h-[240px]" />
      {showFallback ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: fallbackBg,
            backgroundImage: `
              linear-gradient(${grid} 1px, transparent 1px),
              linear-gradient(90deg, ${grid} 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />
      ) : null}
      <div className={`absolute inset-0 ${overlayClassName}`} />
    </div>
  );
}

export function hasGoogleMapsApiKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
}
