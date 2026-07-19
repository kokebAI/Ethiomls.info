"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, LoaderCircle } from "lucide-react";
import {
  ListingAuditEnrichPanel,
  type AuditEnrichCopy,
} from "@/components/admin/ListingAuditEnrichPanel";

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

const QUICK_REJECT_REASONS = [
  "Incomplete or missing ownership / title documents",
  "Price, location, or unit details do not check out",
  "Media looks unreliable or duplicated from another listing",
  "Contact details missing or consent not confirmed",
  "Suspected duplicate or fraudulent listing",
] as const;

export type ListingAuditAttachCopy = {
  title: string;
  lede: string;
  current: string;
  unassigned: string;
  selectLabel: string;
  attachCta: string;
  attaching: string;
  attached: string;
  loadFailed: string;
  roleDeveloper: string;
  roleBroker: string;
  roleOwner: string;
  deactivateTitle?: string;
  deactivateLede?: string;
  deactivateReasonLabel?: string;
  deactivateCta?: string;
  deactivating?: string;
  deactivated?: string;
  deactivateFailed?: string;
  deactivateNeedReason?: string;
  deactivateNoDeveloper?: string;
  reasons?: {
    FRAUDULENT_PROFILE?: string;
    UNLICENSED_OR_UNAUTHORIZED?: string;
    REPEATED_NONCOMPLIANT_LISTINGS?: string;
    DUPLICATE_ACCOUNT?: string;
    OWNER_REQUESTED_REMOVAL?: string;
    POLICY_VIOLATION?: string;
  };
};

const DEACTIVATE_REASON_KEYS = [
  "FRAUDULENT_PROFILE",
  "UNLICENSED_OR_UNAUTHORIZED",
  "REPEATED_NONCOMPLIANT_LISTINGS",
  "DUPLICATE_ACCOUNT",
  "OWNER_REQUESTED_REMOVAL",
  "POLICY_VIOLATION",
] as const;

type DeactivateReason = (typeof DEACTIVATE_REASON_KEYS)[number];

const DEACTIVATE_REASON_FALLBACKS: Record<DeactivateReason, string> = {
  FRAUDULENT_PROFILE: "Fraudulent or fake developer profile",
  UNLICENSED_OR_UNAUTHORIZED: "Unlicensed or unauthorized to list",
  REPEATED_NONCOMPLIANT_LISTINGS:
    "Repeated incomplete or non-compliant listings",
  DUPLICATE_ACCOUNT: "Duplicate developer account",
  OWNER_REQUESTED_REMOVAL: "Developer requested account removal",
  POLICY_VIOLATION: "Other EthioMLS policy violation",
};

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
  rejectedToDraft?: string;
  published?: string;
  auditFailed?: string;
  publishFailed?: string;
  checkAll?: string;
  uncheckAll?: string;
  rejectNeedsNotes?: string;
  approveNeedsChecks?: string;
  publishNeedsApprove?: string;
  quickRejectLabel?: string;
  checks: Record<ChecklistKey, string>;
  enrich: AuditEnrichCopy;
  attach: ListingAuditAttachCopy;
};

export type ListingAttachmentSummary = {
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  ownerPhone: string | null;
  developerTradeName: string | null;
  delalaDisplayName: string | null;
  /** User id of the linked corporate developer (if any). */
  developerUserId?: string | null;
};

type RoleAccountOption = {
  userId: string;
  label: string;
  role: string;
  phone: string | null;
  listingCount: number;
};

type ListingAuditPanelProps = {
  listingId: string;
  status: string;
  alreadyApproved: boolean;
  attachment: ListingAttachmentSummary;
  copy: ListingAuditPanelCopy;
  factsTitle: string;
  facts: { label: string; value: string }[];
  priceLabel?: string;
  priceValue?: string;
};

function roleLabel(role: string, copy: ListingAuditAttachCopy): string {
  if (role === "CORPORATE_DEVELOPER") return copy.roleDeveloper;
  if (role === "INDEPENDENT_DELALA") return copy.roleBroker;
  if (role === "PROPERTY_OWNER") return copy.roleOwner;
  return role.replaceAll("_", " ");
}

function attachmentLine(
  attachment: ListingAttachmentSummary,
  copy: ListingAuditAttachCopy,
): string {
  const party =
    attachment.developerTradeName ||
    attachment.delalaDisplayName ||
    attachment.ownerName;
  if (!party) return copy.unassigned;
  const bits = [
    party,
    roleLabel(attachment.ownerRole, copy),
    attachment.ownerPhone,
  ].filter(Boolean);
  return bits.join(" · ");
}

export function ListingAuditPanel({
  listingId,
  status: initialStatus,
  alreadyApproved,
  attachment: initialAttachment,
  copy,
  factsTitle,
  facts,
  priceLabel,
  priceValue,
}: ListingAuditPanelProps) {
  const router = useRouter();
  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>(() =>
    Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, false])) as Record<
      ChecklistKey,
      boolean
    >,
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<
    "approve" | "reject" | "publish" | "attach" | "deactivate" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    alreadyApproved ? copy.approvedReady : null,
  );
  const [approved, setApproved] = useState(alreadyApproved);
  const [status, setStatus] = useState(initialStatus);
  const [attachment, setAttachment] =
    useState<ListingAttachmentSummary>(initialAttachment);
  const [accounts, setAccounts] = useState<RoleAccountOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [deactivateReason, setDeactivateReason] = useState<DeactivateReason | "">(
    "",
  );

  useEffect(() => {
    setAttachment(initialAttachment);
  }, [initialAttachment]);

  useEffect(() => {
    setStatus(initialStatus);
    setApproved(alreadyApproved);
    if (alreadyApproved) {
      setMessage(copy.approvedReady);
    }
  }, [initialStatus, alreadyApproved, copy.approvedReady]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/role-accounts");
        const data = (await res.json().catch(() => ({}))) as {
          data?: RoleAccountOption[];
          message?: string;
        };
        if (!res.ok) {
          throw new Error(data.message ?? copy.attach.loadFailed);
        }
        if (!cancelled) {
          setAccounts(data.data ?? []);
          setAccountsError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setAccountsError(
            err instanceof Error ? err.message : copy.attach.loadFailed,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [copy.attach.loadFailed]);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        ...account,
        optionLabel: `${account.label} · ${roleLabel(account.role, copy.attach)}${
          account.phone ? ` · ${account.phone}` : ""
        } (${account.listingCount})`,
      })),
    [accounts, copy.attach],
  );

  const allChecked = CHECKLIST_KEYS.every((key) => checks[key]);
  const notesReadyForReject = notes.trim().length >= 5;
  const notesReadyForApprove = notes.trim().length >= 10;
  const isPublished = status === "PUBLISHED";
  const canPublish = approved && status === "PENDING_REVIEW";
  const canDeactivateDeveloper = Boolean(
    attachment.developerUserId ||
      attachment.developerTradeName ||
      attachment.ownerRole === "CORPORATE_DEVELOPER",
  );

  function setAllChecks(value: boolean) {
    setChecks(
      Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, value])) as Record<
        ChecklistKey,
        boolean
      >,
    );
  }

  async function deactivateDeveloper() {
    if (!canDeactivateDeveloper) {
      setError(
        copy.attach.deactivateNoDeveloper ??
          "No developer is attached to this listing.",
      );
      return;
    }
    if (!deactivateReason) {
      setError(
        copy.attach.deactivateNeedReason ??
          "Choose a reason before deactivating the developer.",
      );
      return;
    }
    setBusy("deactivate");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/deactivate-developer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: deactivateReason,
            ...(attachment.developerUserId
              ? { userId: attachment.developerUserId }
              : attachment.ownerRole === "CORPORATE_DEVELOPER"
                ? { userId: attachment.ownerId }
                : {}),
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        data?: { status?: string };
      };
      if (!res.ok) {
        throw new Error(
          data.message ??
            copy.attach.deactivateFailed ??
            "Could not deactivate developer",
        );
      }
      setApproved(false);
      setStatus(data.data?.status ?? "DRAFT");
      setAttachment((prev) => ({
        ...prev,
        developerTradeName: null,
        developerUserId: null,
      }));
      setDeactivateReason("");
      setMessage(
        copy.attach.deactivated ??
          "Developer deactivated and listing moved to draft.",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (copy.attach.deactivateFailed ?? "Could not deactivate developer"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function attachAccount() {
    if (!selectedUserId) return;
    setBusy("attach");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        data?: {
          ownerId: string;
          ownerName: string;
          ownerRole: string;
          ownerPhone: string | null;
          developerTradeName: string | null;
          delalaDisplayName: string | null;
        };
      };
      if (!res.ok || !data.data) {
        throw new Error(data.message ?? "Could not attach account");
      }
      setAttachment({
        ownerId: data.data.ownerId,
        ownerName: data.data.ownerName,
        ownerRole: data.data.ownerRole,
        ownerPhone: data.data.ownerPhone,
        developerTradeName: data.data.developerTradeName,
        delalaDisplayName: data.data.delalaDisplayName,
      });
      setMessage(copy.attach.attached);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach account");
    } finally {
      setBusy(null);
    }
  }

  async function submitAudit(
    decision: "APPROVE" | "REJECT",
    notesOverride?: string,
  ) {
    const decisionNotes = (notesOverride ?? notes).trim();
    const minLen = decision === "REJECT" ? 5 : 10;
    if (decisionNotes.length < minLen) {
      setError(
        decision === "REJECT"
          ? (copy.rejectNeedsNotes ??
              "Add a reject reason (min. 5 characters), or tap a quick reason.")
          : (copy.approveNeedsChecks ??
              "Add an approval reason (min. 10 characters) and complete every check."),
      );
      return;
    }
    if (decision === "APPROVE" && !allChecked) {
      setError(
        copy.approveNeedsChecks ??
          "Tick every client-protection check before approving.",
      );
      return;
    }

    setBusy(decision === "APPROVE" ? "approve" : "reject");
    setError(null);
    setMessage(null);
    if (notesOverride) setNotes(notesOverride);
    try {
      const res = await fetch(`/api/listings/${listingId}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: decisionNotes,
          checklist: checks,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        data?: { status?: string };
      };
      if (!res.ok) {
        throw new Error(data.message ?? copy.auditFailed ?? "Audit failed");
      }
      if (decision === "APPROVE") {
        setApproved(true);
        setStatus(data.data?.status ?? "PENDING_REVIEW");
        setMessage(copy.approvedReady);
      } else {
        setApproved(false);
        setStatus(data.data?.status ?? "DRAFT");
        setMessage(
          copy.rejectedToDraft ?? "Listing rejected and returned to draft.",
        );
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (copy.auditFailed ?? "Audit failed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function publishListing() {
    if (!canPublish) {
      setError(
        copy.publishNeedsApprove ??
          "Approve the audit first — Publish appears once every check passes.",
      );
      return;
    }
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
        throw new Error(data.message ?? copy.publishFailed ?? "Publish failed");
      }
      setStatus("PUBLISHED");
      setMessage(copy.published ?? "Listing published.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (copy.publishFailed ?? "Publish failed"),
      );
    } finally {
      setBusy(null);
    }
  }

  if (isPublished) {
    return (
      <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 shadow-[var(--shadow-card)] sm:p-5">
        <p className="text-sm font-medium text-emerald-800">
          {copy.published ?? "Listing published."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{copy.title}</h2>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          {copy.statusLabel}: {status.replaceAll("_", " ")}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy.lede}</p>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {copy.attach.title}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{copy.attach.lede}</p>
        <p className="mt-3 text-sm text-slate-800">
          <span className="font-medium text-slate-500">
            {copy.attach.current}:{" "}
          </span>
          {attachmentLine(attachment, copy.attach)}
        </p>
        {accountsError ? (
          <p className="mt-2 text-sm text-rose-700">{accountsError}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="grid min-w-0 flex-1 gap-1.5">
              <span className="text-sm font-medium text-slate-700">
                {copy.attach.selectLabel}
              </span>
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">—</option>
                {accountOptions.map((account) => (
                  <option key={account.userId} value={account.userId}>
                    {account.optionLabel}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={Boolean(busy) || !selectedUserId}
              onClick={() => void attachAccount()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === "attach" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              {busy === "attach" ? copy.attach.attaching : copy.attach.attachCta}
            </button>
          </div>
        )}

        {canDeactivateDeveloper ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
            <h4 className="text-sm font-semibold text-rose-900">
              {copy.attach.deactivateTitle ?? "Deactivate developer"}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-rose-800/90">
              {copy.attach.deactivateLede ??
                "Turns off their login and moves this listing to draft."}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="grid min-w-0 flex-1 gap-1.5">
                <span className="text-sm font-medium text-rose-900">
                  {copy.attach.deactivateReasonLabel ?? "Reason"}
                </span>
                <select
                  value={deactivateReason}
                  onChange={(event) =>
                    setDeactivateReason(
                      event.target.value as DeactivateReason | "",
                    )
                  }
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                >
                  <option value="">—</option>
                  {DEACTIVATE_REASON_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {copy.attach.reasons?.[key] ??
                        DEACTIVATE_REASON_FALLBACKS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={Boolean(busy) || !deactivateReason}
                onClick={() => void deactivateDeveloper()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
              >
                {busy === "deactivate" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
                {busy === "deactivate"
                  ? (copy.attach.deactivating ?? "Deactivating…")
                  : (copy.attach.deactivateCta ?? "Deactivate & draft listing")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{copy.title}</h3>
            <button
              type="button"
              onClick={() => setAllChecks(!allChecked)}
              className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              {allChecked
                ? (copy.uncheckAll ?? "Uncheck all")
                : (copy.checkAll ?? "Check all")}
            </button>
          </div>
          <ul className="space-y-2">
            {CHECKLIST_KEYS.map((key) => {
              const done = checks[key];
              return (
                <li key={key}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800">
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
                    <span className="leading-snug">{copy.checks[key]}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="min-w-0">
          <ListingAuditEnrichPanel listingId={listingId} copy={copy.enrich} />
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">{factsTitle}</h3>
          {priceValue ? (
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">
              {priceValue}
              {priceLabel ? (
                <span className="ml-1 text-xs font-medium text-slate-500">
                  {priceLabel}
                </span>
              ) : null}
            </p>
          ) : null}
          <dl className="mt-3 space-y-2.5">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
              >
                <dt className="text-xs font-medium text-slate-500">
                  {fact.label}
                </dt>
                <dd className="text-right text-sm font-semibold text-slate-900">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium text-slate-700">
          {copy.quickRejectLabel ?? "Quick reject reasons"}
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_REJECT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void submitAudit("REJECT", reason)}
              className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-left text-xs font-semibold text-rose-800 transition hover:bg-rose-50 disabled:opacity-50"
            >
              {reason}
            </button>
          ))}
        </div>
      </div>

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
        {!notesReadyForReject ? (
          <span className="text-xs text-amber-700">
            {copy.rejectNeedsNotes ??
              "Reject needs 5+ characters (or tap a quick reason). Approve needs 10+ and every check."}
          </span>
        ) : null}
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
          disabled={Boolean(busy) || !notesReadyForApprove || !allChecked}
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
          disabled={Boolean(busy) || !notesReadyForReject}
          onClick={() => void submitAudit("REJECT")}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 disabled:opacity-50"
        >
          {busy === "reject" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : null}
          {busy === "reject" ? copy.saving : copy.reject}
        </button>
        <button
          type="button"
          disabled={Boolean(busy) || !canPublish}
          onClick={() => void publishListing()}
          title={
            canPublish
              ? undefined
              : (copy.publishNeedsApprove ??
                "Approve the audit first, then publish")
          }
          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy === "publish" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : null}
          {busy === "publish" ? copy.publishing : copy.publish}
        </button>
      </div>
      {!canPublish ? (
        <p className="mt-2 text-xs text-slate-500">
          {copy.publishNeedsApprove ??
            "Publish unlocks after you approve every checklist item with a written reason."}
        </p>
      ) : null}
    </section>
  );
}
