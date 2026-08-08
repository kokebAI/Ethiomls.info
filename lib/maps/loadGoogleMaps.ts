type GoogleMapsNs = {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
    Marker?: new (opts: Record<string, unknown>) => {
      addListener?: (event: string, handler: () => void) => void;
      setMap?: (map: unknown) => void;
    };
    LatLngBounds?: new () => {
      extend: (p: { lat: number; lng: number }) => void;
    };
    SymbolPath?: { CIRCLE: number };
    InfoWindow?: new (opts: Record<string, unknown>) => {
      open: (opts: { map: unknown }) => void;
    };
    event?: { trigger: (instance: unknown, name: string) => void };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsNs;
    __ethioMapsReady?: () => void;
  }
}

let mapsScriptPromise: Promise<void> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.Map) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.google?.maps?.Map) resolve();
      else reject(new Error("Google Maps loaded without maps API"));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-ethio-google-maps="1"]',
    );
    if (existing) {
      if (window.google?.maps?.Map) {
        finish();
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Maps failed to load")),
        { once: true },
      );
      window.setTimeout(() => {
        if (window.google?.maps?.Map) finish();
      }, 0);
      return;
    }

    const callbackName = "__ethioMapsReady";
    window[callbackName] = () => {
      finish();
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    };

    const script = document.createElement("script");
    script.dataset.ethioGoogleMaps = "1";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&callback=${callbackName}`;
    script.onerror = () => {
      mapsScriptPromise = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(script);
  });

  return mapsScriptPromise;
}

export type { GoogleMapsNs };
