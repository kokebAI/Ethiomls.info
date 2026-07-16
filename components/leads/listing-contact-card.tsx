"use client";

import { useMemo, useState } from "react";
import { ConsentGateModal } from "@/components/leads/consent-gate-modal";
import { useTranslation } from "@/hooks/useTranslation";
import { maskE164Phone } from "@/lib/leads/phoneMask";
import styles from "./listing-contact-card.module.css";

export type ListingContactCardProps = {
  listingId: string;
  /** Raw broker phone — never rendered until Consent Gate succeeds. */
  brokerPhone: string;
  brokerDisplayName?: string;
  requesterId?: string;
  className?: string;
};

/**
 * Listing contact handler — hides direct broker telephone indices behind Consent Gate.
 */
export function ListingContactCard({
  listingId,
  brokerPhone,
  brokerDisplayName,
  requesterId,
  className,
}: ListingContactCardProps) {
  const { t } = useTranslation();
  const maskedPhone = useMemo(() => maskE164Phone(brokerPhone), [brokerPhone]);
  const [open, setOpen] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);

  return (
    <div className={`${styles.root} ${className ?? ""}`.trim()}>
      <div className={styles.row}>
        <div>
          <p className={styles.label}>{t("consent.contactLabel")}</p>
          <p className={styles.value}>
            {brokerDisplayName ? `${brokerDisplayName} · ` : ""}
            {revealedPhone ?? maskedPhone}
          </p>
        </div>
        {!revealedPhone ? (
          <button
            type="button"
            className={styles.cta}
            onClick={() => setOpen(true)}
          >
            {t("consent.requestContact")}
          </button>
        ) : (
          <a className={styles.cta} href={`tel:${revealedPhone}`}>
            {t("consent.callNow")}
          </a>
        )}
      </div>

      <ConsentGateModal
        open={open}
        listingId={listingId}
        requesterId={requesterId}
        brokerDisplayName={brokerDisplayName}
        maskedPhone={maskedPhone}
        onClose={() => setOpen(false)}
        onRouted={({ revealedPhone: phone }) => setRevealedPhone(phone)}
      />
    </div>
  );
}

export default ListingContactCard;
