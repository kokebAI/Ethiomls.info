"use client";

import { useTranslation } from "@/hooks/useTranslation";
import styles from "./property-description-card.module.css";

export type PropertyDescriptionCardProps = {
  title: string;
  description: string;
  listingType: "SALE" | "RENT" | "OFF_PLAN" | string;
  subCity?: string;
  priceLabel?: string;
  metadata?: string[];
  /** Proc. 1388/2025 clearance badge — from backend `foreignerEligible`. */
  foreignerEligible?: boolean;
  escrowVerified?: boolean;
  className?: string;
};

function isOffPlan(listingType: string): boolean {
  return listingType === "OFF_PLAN";
}

/**
 * Property detail description card with regulatory badges and a fixed
 * Proc. 1357/2024 off-plan escrow legal warning.
 */
export function PropertyDescriptionCard({
  title,
  description,
  listingType,
  subCity,
  priceLabel,
  metadata = [],
  foreignerEligible = false,
  escrowVerified = false,
  className,
}: PropertyDescriptionCardProps) {
  const { t } = useTranslation();
  const offPlan = isOffPlan(listingType);

  return (
    <article className={`${styles.card} ${className ?? ""}`.trim()}>
      <header className={styles.header}>
        <div className={styles.headingBlock}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.metaRow}>
            {subCity ? (
              <span className={styles.metaChip}>
                {t("listing.subCity")}: {subCity}
              </span>
            ) : null}
            {priceLabel ? (
              <span className={styles.metaChip}>
                {t("listing.price")}: {priceLabel}
              </span>
            ) : null}
            <span className={styles.metaChip}>
              {listingType === "SALE"
                ? t("listing.forSale")
                : listingType === "RENT"
                  ? t("listing.forRent")
                  : t("listing.offPlan")}
            </span>
          </div>
        </div>

        <div className={styles.badges}>
          {escrowVerified || offPlan ? (
            <span className={`${styles.badge} ${styles.badgeEscrow}`}>
              {t("listing.escrowVerified")}
            </span>
          ) : null}
          {foreignerEligible ? (
            <span className={`${styles.badge} ${styles.badgeForeign}`}>
              {t("compliance.foreignBadge")}
            </span>
          ) : null}
        </div>
      </header>

      {offPlan ? (
        <aside
          className={styles.legalWarning}
          role="note"
          aria-label={t("compliance.offPlanWarningTitle")}
        >
          <span className={styles.legalEyebrow}>
            {t("compliance.offPlanWarningTitle")}
          </span>
          <p className={styles.legalBody}>{t("compliance.offPlanWarningBody")}</p>
          <p className={styles.legalCite}>{t("compliance.offPlanWarningCite")}</p>
        </aside>
      ) : null}

      <div className={styles.description}>
        <p>{description}</p>
      </div>

      {metadata.length > 0 ? (
        <ul className={styles.tags}>
          {metadata.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default PropertyDescriptionCard;
