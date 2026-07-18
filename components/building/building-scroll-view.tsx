"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatMoney } from "@/lib/compliance/currency";
import {
  countAvailableUnits,
  sortFloorsTopDown,
  type Building,
  type BuildingFloor,
  type BuildingUnit,
} from "@/lib/building/types";
import { BuildingShowreel } from "@/components/building/building-showreel";
import styles from "./building-scroll-view.module.css";

type BuildingScrollViewProps = {
  building: Building;
  className?: string;
  onUnitSelect?: (unit: BuildingUnit) => void;
};

function floorKey(level: number) {
  return `floor-${level}`;
}

function UnitSubCard({
  unit,
  onSelect,
}: {
  unit: BuildingUnit;
  onSelect?: (unit: BuildingUnit) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.unitCard}
      onClick={() => onSelect?.(unit)}
    >
      <div className={styles.unitTop}>
        <strong>{unit.unitLabel}</strong>
        <span
          className={
            unit.status === "available"
              ? styles.statusAvailable
              : unit.status === "reserved"
                ? styles.statusReserved
                : styles.statusSold
          }
        >
          {t(`building.status.${unit.status}`)}
        </span>
      </div>
      {unit.propertyId ? (
        <p className={styles.unitTitle} style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", opacity: 0.85 }}>
          {unit.propertyId}
        </p>
      ) : null}
      <p className={styles.unitTitle}>
        {unit.title ?? t("building.unnamedUnit")}
      </p>
      <div className={styles.unitMeta}>
        {typeof unit.bedrooms === "number" ? (
          <span>
            {unit.bedrooms} {t("listing.bedrooms")}
          </span>
        ) : null}
        {typeof unit.sizeM2 === "number" ? (
          <span>
            {unit.sizeM2} m²
          </span>
        ) : null}
        <span>{formatMoney(unit.price, unit.currency)}</span>
      </div>
    </button>
  );
}

/**
 * Vertical scroll architecture for a Building with nested floor units.
 * Highlights floors while scrolling and opens a sliding panel of unit sub-cards.
 */
export function BuildingScrollView({
  building,
  className,
  onUnitSelect,
}: BuildingScrollViewProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const floors = useMemo(
    () => sortFloorsTopDown(building.floors),
    [building.floors],
  );

  const [activeLevel, setActiveLevel] = useState<number | null>(
    floors[0]?.level ?? null,
  );
  const [panelLevel, setPanelLevel] = useState<number | null>(null);
  const sectionRefs = useRef(new Map<number, HTMLElement>());

  const activeFloor = floors.find((floor) => floor.level === activeLevel) ?? null;
  const panelFloor = floors.find((floor) => floor.level === panelLevel) ?? null;

  const setSectionRef = useCallback((level: number, node: HTMLElement | null) => {
    if (node) sectionRefs.current.set(level, node);
    else sectionRefs.current.delete(level);
  }, []);

  useEffect(() => {
    const nodes = [...sectionRefs.current.values()];
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top) return;
        const level = Number((top.target as HTMLElement).dataset.floorLevel);
        if (Number.isFinite(level)) setActiveLevel(level);
      },
      {
        root: null,
        threshold: [0.35, 0.55, 0.75],
        rootMargin: "-20% 0px -35% 0px",
      },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [floors]);

  function openFloor(level: number) {
    setActiveLevel(level);
    setPanelLevel(level);
    sectionRefs.current.get(level)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function closePanel() {
    setPanelLevel(null);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section
      className={`${styles.root} ${className ?? ""}`.trim()}
      aria-labelledby={titleId}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t("building.showreelEyebrow")}</p>
          <h2 id={titleId} className={styles.title}>
            {building.name}
          </h2>
          <p className={styles.meta}>
            {building.subCity}
            {building.addressLine ? ` · ${building.addressLine}` : ""}
            {building.developerName ? ` · ${building.developerName}` : ""}
          </p>
        </div>
        {activeFloor ? (
          <div className={styles.liveBadge} aria-live="polite">
            <span className={styles.livePulse} aria-hidden="true" />
            {t("building.liveFloor", {
              level: activeFloor.level,
            })}{" "}
            · {countAvailableUnits(activeFloor)} {t("building.availableUnits")}
          </div>
        ) : null}
      </header>

      <div className={styles.showreelHero}>
        <BuildingShowreel
          building={building}
          activeLevel={activeLevel}
          onFloorSelect={openFloor}
          variant="hero"
        />
      </div>

      <div className={styles.layout}>
        <div className={styles.scrollColumn}>
          {floors.map((floor) => {
            const available = countAvailableUnits(floor);
            const active = floor.level === activeLevel;
            return (
              <article
                key={floorKey(floor.level)}
                ref={(node) => setSectionRef(floor.level, node)}
                data-floor-level={floor.level}
                className={
                  active
                    ? `${styles.floorSection} ${styles.floorSectionActive}`
                    : styles.floorSection
                }
              >
                <div className={styles.floorBand}>
                  <div>
                    <h3 className={styles.floorTitle}>
                      {floor.label ??
                        t("building.floorLabel", { level: floor.level })}
                    </h3>
                    <p className={styles.floorStats}>
                      <strong>{available}</strong> {t("building.availableUnits")}
                      <span aria-hidden="true"> · </span>
                      {floor.units.length} {t("building.totalUnits")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.inspectBtn}
                    onClick={() => openFloor(floor.level)}
                  >
                    {t("building.inspectFloor")}
                  </button>
                </div>

                <div className={styles.unitStrip} aria-hidden="true">
                  {floor.units.map((unit) => (
                    <span
                      key={unit.id}
                      className={
                        unit.status === "available"
                          ? styles.unitPipAvailable
                          : unit.status === "reserved"
                            ? styles.unitPipReserved
                            : styles.unitPipSold
                      }
                      title={`${unit.unitLabel} · ${t(`building.status.${unit.status}`)}`}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div
        className={
          panelFloor
            ? `${styles.panelBackdrop} ${styles.panelBackdropOpen}`
            : styles.panelBackdrop
        }
        onClick={closePanel}
        aria-hidden={!panelFloor}
      />

      <aside
        className={
          panelFloor
            ? `${styles.sidePanel} ${styles.sidePanelOpen}`
            : styles.sidePanel
        }
        aria-hidden={!panelFloor}
        aria-label={t("building.panelLabel")}
      >
        {panelFloor ? (
          <>
            <div className={styles.panelHeader}>
              <div>
                <h3 className={styles.panelTitle}>
                  {panelFloor.label ??
                    t("building.floorLabel", { level: panelFloor.level })}
                </h3>
                <p className={styles.panelSub}>
                  {countAvailableUnits(panelFloor)} {t("building.availableUnits")}
                </p>
              </div>
              <button
                type="button"
                className={styles.panelClose}
                onClick={closePanel}
                aria-label={t("building.closePanel")}
              >
                ×
              </button>
            </div>
            <div className={styles.panelBody}>
              {panelFloor.units.map((unit) => (
                <UnitSubCard
                  key={unit.id}
                  unit={unit}
                  onSelect={onUnitSelect}
                />
              ))}
            </div>
          </>
        ) : null}
      </aside>
    </section>
  );
}

export default BuildingScrollView;
