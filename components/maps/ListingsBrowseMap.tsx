"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ADDIS_MAP_CENTER, ADDIS_MAP_ZOOM } from "@/lib/maps/addisSubcityCentroids";
import { loadGoogleMaps } from "@/lib/maps/loadGoogleMaps";

export type MapListingPin = {
  id: string;
  title: string;
  listingType: string;
  lat: number;
  lng: number;
  approx: boolean;
  subCity: string | null;
  href: string;
};

const TYPE_COLORS: Record<string, string> = {
  SALE: "#059669",
  RENT: "#0284c7",
  OFF_PLAN: "#d97706",
};

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

export function ListingsBrowseMap({
  pins,
  focusId,
  labels,
}: {
  pins: MapListingPin[];
  focusId?: string;
  labels: {
    approx: string;
    empty: string;
    viewListing: string;
    sale: string;
    rent: string;
    offPlan: string;
    missingKey: string;
    error: string;
  };
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  const card =
    pins.find((p) => p.id === selectedId) ??
    (focusId ? pins.find((p) => p.id === focusId) : undefined) ??
    null;

  const typeLabel = (type: string) => {
    if (type === "RENT") return labels.rent;
    if (type === "OFF_PLAN") return labels.offPlan;
    return labels.sale;
  };

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
        if (cancelled || !mapEl.current || !g?.Map || !g.Marker) {
          if (!cancelled) setStatus("error");
          return;
        }

        if (!mapRef.current) {
          mapRef.current = new g.Map(mapEl.current, {
            center: { lat: ADDIS_MAP_CENTER.lat, lng: ADDIS_MAP_CENTER.lng },
            zoom: ADDIS_MAP_ZOOM,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
            clickableIcons: false,
            styles: LIGHT_MAP_STYLES,
            backgroundColor: "#e8eaed",
          });
        }

        for (const m of markersRef.current) {
          (m as { setMap?: (v: null) => void }).setMap?.(null);
        }
        markersRef.current = [];

        const circlePath = g.SymbolPath?.CIRCLE ?? 0;
        for (const pin of pins) {
          const color = TYPE_COLORS[pin.listingType] ?? "#64748b";
          const marker = new g.Marker({
            map: mapRef.current,
            position: { lat: pin.lat, lng: pin.lng },
            title: pin.title,
            icon: {
              path: circlePath,
              scale: 8,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
          marker.addListener?.("click", () => {
            setSelectedId(pin.id);
            (
              mapRef.current as {
                panTo?: (p: { lat: number; lng: number }) => void;
              }
            )?.panTo?.({ lat: pin.lat, lng: pin.lng });
          });
          markersRef.current.push(marker);
        }

        const initialFocus =
          pins.find((p) => p.id === focusId) ??
          (pins.length === 1 ? pins[0] : null);

        if (initialFocus) {
          (
            mapRef.current as {
              setCenter?: (p: { lat: number; lng: number }) => void;
              setZoom?: (z: number) => void;
            }
          ).setCenter?.({ lat: initialFocus.lat, lng: initialFocus.lng });
          (mapRef.current as { setZoom?: (z: number) => void }).setZoom?.(15);
          setSelectedId(initialFocus.id);
        } else if (pins.length > 1 && g.LatLngBounds) {
          const bounds = new g.LatLngBounds();
          for (const pin of pins) {
            bounds.extend({ lat: pin.lat, lng: pin.lng });
          }
          (
            mapRef.current as {
              fitBounds?: (b: unknown, padding?: number) => void;
            }
          ).fitBounds?.(bounds, 48);
        }

        window.setTimeout(() => {
          if (!cancelled && mapRef.current) {
            g.event?.trigger(mapRef.current, "resize");
          }
        }, 120);

        setStatus("ready");
      } catch (err) {
        console.error("ListingsBrowseMap init failed", err);
        if (!cancelled) setStatus("error");
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [apiKey, pins, focusId]);

  const legend = [
    { label: labels.sale, color: TYPE_COLORS.SALE },
    { label: labels.rent, color: TYPE_COLORS.RENT },
    { label: labels.offPlan, color: TYPE_COLORS.OFF_PLAN },
  ];

  return (
    <div className="space-y-4">
      <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <div ref={mapEl} className="absolute inset-0 h-full w-full" />
        {status === "missing" || status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/95 px-4 text-center text-sm font-semibold text-slate-500">
            {status === "missing" ? labels.missingKey : labels.error}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {pins.length === 0 ? (
        <p className="text-sm text-slate-500">{labels.empty}</p>
      ) : null}

      {card ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            <span
              className="mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white"
              style={{
                background: TYPE_COLORS[card.listingType] ?? "#64748b",
              }}
            >
              {typeLabel(card.listingType)}
            </span>
            {card.subCity ?? ""}
            {card.approx ? ` · ${labels.approx}` : ""}
          </p>
          <div className="mt-3">
            <Link
              href={card.href}
              className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              {labels.viewListing}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
