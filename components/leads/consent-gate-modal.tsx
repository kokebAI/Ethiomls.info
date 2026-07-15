"use client";

import { useId, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import styles from "./consent-gate-modal.module.css";

export type ConsentGateModalProps = {
  open: boolean;
  brokerDisplayName?: string;
  maskedPhone: string;
  listingId: string;
  requesterId?: string;
  onClose: () => void;
  onRouted?: (result: {
    leadId: string;
    revealedPhone: string | null;
    maskedPhone: string;
  }) => void;
};

/**
 * Consent Gate modal — broker telephone stays masked until the checkbox is ticked
 * and `/api/leads/secure-route` confirms capture.
 */
export function ConsentGateModal({
  open,
  brokerDisplayName,
  maskedPhone,
  listingId,
  requesterId,
  onClose,
  onRouted,
}: ConsentGateModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function confirm() {
    if (!checked) {
      setError(t("consent.mustTick"));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/leads/secure-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          requesterId,
          consentAccepted: true,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        leadId?: string;
        contact?: { revealedPhone?: string | null; maskedPhone?: string };
      };

      if (!response.ok) {
        setError(data.message ?? t("consent.routeFailed"));
        return;
      }

      onRouted?.({
        leadId: data.leadId ?? "",
        revealedPhone: data.contact?.revealedPhone ?? null,
        maskedPhone: data.contact?.maskedPhone ?? maskedPhone,
      });
      onClose();
    } catch {
      setError(t("consent.routeFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {t("consent.title")}
        </h2>
        <p className={styles.body}>{t("consent.body")}</p>

        <div className={styles.masked}>
          <span>{t("consent.maskedLabel")}</span>
          <strong>
            {brokerDisplayName ? `${brokerDisplayName} · ` : ""}
            {maskedPhone}
          </strong>
        </div>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>{t("consent.checkbox")}</span>
        </label>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t("consent.cancel")}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={!checked || pending}
            onClick={() => void confirm()}
          >
            {pending ? t("common.loading") : t("consent.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConsentGateModal;
