"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { PanoramaEngine } from "@/lib/vr/panorama-engine";
import type { VrViewerProps } from "@/lib/vr/types";
import { isWebGLAvailable } from "@/lib/vr/webgl";
import styles from "./vr-viewer.module.css";

function sceneLabel(
  config: VrViewerProps["config"],
  index: number,
  total: number,
) {
  return config?.scenes?.[index]?.label ?? `Scene ${index + 1} / ${total}`;
}

function GridFallback({
  urls,
  config,
  activeIndex,
  onSelect,
}: {
  urls: string[];
  config: VrViewerProps["config"];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className={styles.grid} role="list" aria-label="Panorama grid view">
      <p className={styles.fallbackNote}>
        WebGL is unavailable in this browser. Showing a clean grid of walkthrough
        frames instead.
      </p>
      <div className={styles.gridInner}>
        {urls.map((url, index) => {
          const label = sceneLabel(config, index, urls.length);
          const hotspots = config?.scenes?.[index]?.hotspots ?? [];
          return (
            <button
              key={`${url}-${index}`}
              type="button"
              role="listitem"
              className={
                index === activeIndex
                  ? `${styles.gridCard} ${styles.gridCardActive}`
                  : styles.gridCard
              }
              onClick={() => onSelect(index)}
            >
              <img src={url} alt={label} className={styles.gridImage} />
              <span className={styles.gridMeta}>
                <span className={styles.gridTitle}>{label}</span>
                {hotspots.length > 0 ? (
                  <span className={styles.gridLinks}>
                    Links:{" "}
                    {hotspots
                      .map((h) => h.label ?? `Scene ${h.targetIndex + 1}`)
                      .join(" · ")}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 360° equirectangular walkthrough viewer.
 * Drag to look around, optional gyroscope on mobile, hotspot markers to travel
 * between panorama frames. Falls back to a grid gallery when WebGL is disabled.
 */
export function VrViewer({
  panoramicImageUrls,
  config = null,
  initialIndex = 0,
  className,
  onSceneChange,
}: VrViewerProps) {
  const urls = useMemo(
    () => panoramicImageUrls.filter((url) => typeof url === "string" && url.length > 0),
    [panoramicImageUrls],
  );

  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PanoramaEngine | null>(null);

  const titleId = useId();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [sceneIndex, setSceneIndex] = useState(initialIndex);
  const [gyroOn, setGyroOn] = useState(false);
  const [gyroSupported, setGyroSupported] = useState(false);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleSceneChange = useCallback(
    (index: number) => {
      setSceneIndex(index);
      onSceneChange?.(index);
    },
    [onSceneChange],
  );

  useEffect(() => {
    setWebgl(isWebGLAvailable());
    setGyroSupported(
      typeof window !== "undefined" && "DeviceOrientationEvent" in window,
    );
  }, []);

  useEffect(() => {
    if (webgl !== true) return;
    if (!shellRef.current || !canvasRef.current || !overlayRef.current) return;
    if (urls.length === 0) return;

    const engine = new PanoramaEngine({
      container: shellRef.current,
      canvas: canvasRef.current,
      overlayRoot: overlayRef.current,
      imageUrls: urls,
      config,
      initialIndex,
      onSceneChange: handleSceneChange,
      onHotspotFocus: setFocusLabel,
      onError: setLoadError,
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Recreate only when source gallery identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl, urls.join("|"), JSON.stringify(config ?? null)]);

  async function toggleGyro() {
    const engine = engineRef.current;
    if (!engine) return;

    if (engine.isGyroEnabled()) {
      engine.disableGyroscope();
      setGyroOn(false);
      return;
    }

    const ok = await engine.enableGyroscope();
    setGyroOn(ok);
    if (!ok) {
      setLoadError(
        "Gyroscope permission was denied. You can still drag to look around.",
      );
    }
  }

  if (urls.length === 0) {
    return (
      <div className={`${styles.root} ${className ?? ""}`.trim()}>
        <div className={styles.empty}>No panoramic images available.</div>
      </div>
    );
  }

  const label = sceneLabel(config, sceneIndex, urls.length);

  return (
    <div className={`${styles.root} ${className ?? ""}`.trim()}>
      <div className={styles.toolbar}>
        <div className={styles.sceneMeta}>
          <h2 id={titleId} className={styles.sceneTitle}>
            {label}
          </h2>
          <p className={styles.sceneHint}>
            {webgl === false
              ? "Grid mode"
              : focusLabel
                ? `Navigate to ${focusLabel}`
                : "Drag to look · tap hotspots to move between rooms"}
          </p>
        </div>

        <div className={styles.actions}>
          {webgl === true && gyroSupported ? (
            <button
              type="button"
              className={gyroOn ? `${styles.btn} ${styles.btnActive}` : styles.btn}
              onClick={() => void toggleGyro()}
            >
              {gyroOn ? "Gyro on" : "Enable gyro"}
            </button>
          ) : null}

          <div className={styles.thumbs} role="tablist" aria-label="Scenes">
            {urls.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === sceneIndex}
                className={
                  index === sceneIndex
                    ? `${styles.thumb} ${styles.thumbActive}`
                    : styles.thumb
                }
                onClick={() => {
                  setSceneIndex(index);
                  engineRef.current?.goToScene(index);
                  if (webgl === false) onSceneChange?.(index);
                }}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loadError ? (
        <p className={styles.error} role="status">
          {loadError}
        </p>
      ) : null}

      {webgl === null ? (
        <div className={styles.shell} aria-busy="true">
          <div className={styles.loading}>Starting viewer…</div>
        </div>
      ) : webgl ? (
        <div
          ref={shellRef}
          className={styles.shell}
          role="region"
          aria-labelledby={titleId}
        >
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            aria-label="360 degree panoramic walkthrough canvas"
          />
          <div ref={overlayRef} className={styles.overlay} />
        </div>
      ) : (
        <GridFallback
          urls={urls}
          config={config}
          activeIndex={sceneIndex}
          onSelect={(index) => {
            setSceneIndex(index);
            onSceneChange?.(index);
          }}
        />
      )}
    </div>
  );
}

export default VrViewer;
