"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Circle, LoaderCircle } from "lucide-react";

const CHECKLIST_KEYS = [
  "sellerIdentity",
  "ownershipOrAuthority",
  "priceAndPaymentTerms",
  "locationAndUnitDetails",
  "mediaAuthenticity",
  "permitAndConstructionStage",
  "escrowCompliance",
  "contactAndConsent",
  "duplicateAndFraudScreen",
] as const;

type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export type ListingAuditPanelCopy = {
  title: string;
  lede: string;
  notesLabel: string;
  notesPlaceholder: string;
  approve: string;
  reject: string;
  publish: string;
  publishing: string;
  saving: string;
  approvedReady: string;
  statusLabel: string;
  checks: Record<ChecklistKey, string>;
};

type ListingAuditPanelProps = {
  listingId: string;
  status: string;
  alreadyApproved: boolean;
  copy: ListingAuditPanelCopy;
};

export function ListingAuditPanel({
  listingId,
  status,
  alreadyApproved,
  copy,
}: ListingAuditPanelProps) {
  const router = useRouter();
  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>(() =>
    Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, false])) as Record<
      ChecklistKey,
      boolean
    >,
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | "publish" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    alreadyApproved ? copy.approvedReady : null,
  );
  const [approved, setApproved] = useState(alreadyApproved);

  const allChecked = CHECKLIST_KEYS.every((key) => checks[key]);
  const isPublished = status === "PUBLISHED";

  async function submitAudit(decision: "APPROVE" | "REJECT") {
    setBusy(decision === "APPROVE" ? "approve" : "reject");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: notes.trim(),
          checklist: checks,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.message ?? "Audit failed");
      }
      setApproved(decision === "APPROVE");
      setMessage(
        decision === "APPROVE"
          ? copy.approvedReady
          : "Listing rejected and returned to draft.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setBusy(null);
    }
  }

  async function publishListing() {
    setBusy("publish");
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/activate`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.message ?? "Publish failed");
      }
      setMessage("Listing published.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  }

  if (isPublished) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{copy.title}</h2>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          {copy.statusLabel}: {status.replaceAll("_", " ")}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy.lede}</p>

      <ul className="mt-5 space-y-2">
        {CHECKLIST_KEYS.map((key) => {
          const done = checks[key];
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={done}
                  onChange={() =>
                    setChecks((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                />
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                )}
                <span>{copy.checks[key]}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <label className="mt-4 grid gap-1.5">
        <span className="text-sm font-medium text-slate-700">
          {copy.notesLabel}
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder={copy.notesPlaceholder}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </label>

      {error ? (
        <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={Boolean(busy) || notes.trim().length < 10 || !allChecked}
          onClick={() => void submitAudit("APPROVE")}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy === "approve" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : null}
          {busy === "approve" ? copy.saving : copy.approve}
        </button>
        <button
          type="button"
          disabled={Boolean(busy) || notes.trim().length < 10}
          onClick={() => void submitAudit("REJECT")}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "reject" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : null}
          {busy === "reject" ? copy.saving : copy.reject}
        </button>
        {approved ? (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void publishListing()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {busy === "publish" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            {busy === "publish" ? copy.publishing : copy.publish}
          </button>
        ) : null}
      </div>
    </section>
  );
}
