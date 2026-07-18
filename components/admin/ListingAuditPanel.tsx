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

function roleLabel(
  role: string,
  copy: ListingAuditAttachCopy,
): string {
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
  status,
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
    "approve" | "reject" | "publish" | "attach" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    alreadyApproved ? copy.approvedReady : null,
  );
  const [approved, setApproved] = useState(alreadyApproved);
  const [attachment, setAttachment] =
    useState<ListingAttachmentSummary>(initialAttachment);
  const [accounts, setAccounts] = useState<RoleAccountOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [accountsError, setAccountsError] = useState<string | null>(null);

  useEffect(() => {
    setAttachment(initialAttachment);
  }, [initialAttachment]);

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
  const isPublished = status === "PUBLISHED";

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
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {copy.title}
          </h3>
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
