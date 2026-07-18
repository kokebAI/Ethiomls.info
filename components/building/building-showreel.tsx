"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { Building } from "@/lib/building/types";
import { BuildingShowreelEngine } from "@/lib/building/showreel-engine";
import { isWebGLAvailable } from "@/lib/vr/webgl";
import styles from "./building-showreel.module.css";

type BuildingShowreelProps = {
  building: Building;
  activeLevel?: number | null;
  onFloorSelect?: (level: number) => void;
  className?: string;
  /** Compact sticky rail vs full cinematic hero */
  variant?: "rail" | "hero";
};

export function BuildingShowreel({
  building,
  activeLevel = null,
  onFloorSelect,
  className,
  variant = "hero",
}: BuildingShowreelProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BuildingShowreelEngine | null>(null);
  const onFloorSelectRef = useRef(onFloorSelect);
  onFloorSelectRef.current = onFloorSelect;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !isWebGLAvailable()) return;

    const engine = new BuildingShowreelEngine({
      container,
      canvas,
      building,
      activeLevel,
      autoRotate: true,
      onFloorSelect: (level) => onFloorSelectRef.current?.(level),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Rebuild only when building id / floor count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [building.id, building.floors.length]);

  useEffect(() => {
    engineRef.current?.setActiveLevel(activeLevel ?? null);
  }, [activeLevel]);

  if (!isWebGLAvailable()) {
    return (
      <div
        className={`${styles.fallback} ${variant === "hero" ? styles.hero : styles.rail} ${className ?? ""}`}
        role="img"
        aria-label={building.name}
      >
        <p className={styles.fallbackText}>{building.name}</p>
        <p className={styles.fallbackHint}>
          {building.floors.length} {t("building.totalUnits")}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.stage} ${variant === "hero" ? styles.hero : styles.rail} ${className ?? ""}`}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-label={building.name} />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.scan} aria-hidden="true" />
      <div className={styles.hud}>
        <span className={styles.hudEyebrow}>{t("building.showreelEyebrow")}</span>
        <span className={styles.hudHint}>{t("building.showreelHint")}</span>
      </div>
    </div>
  );
}
