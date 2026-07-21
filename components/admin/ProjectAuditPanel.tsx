"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export type ProjectAuditPanelCopy = {
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
  checkAll: string;
  uncheckAll: string;
  rejectNeedsNotes: string;
  approveNeedsChecks: string;
  publishNeedsApprove: string;
  publishAdminOnly?: string;
  checks: Record<ChecklistKey, string>;
};

type ProjectAuditPanelProps = {
  projectId: string;
  status: string;
  alreadyApproved: boolean;
  /** Full admins may publish; office assistants audit only. */
  allowPublish?: boolean;
  copy: ProjectAuditPanelCopy;
};

export function ProjectAuditPanel({
  projectId,
  status: initialStatus,
  alreadyApproved,
  allowPublish = true,
  copy,
}: ProjectAuditPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [approved, setApproved] = useState(alreadyApproved);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | "publish" | null>(
    null,
  );
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>(() =>
    Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, false])) as Record<
      ChecklistKey,
      boolean
    >,
  );

  const allChecked = useMemo(
    () => CHECKLIST_KEYS.every((key) => checks[key]),
    [checks],
  );
  const canPublish = allowPublish && approved && status === "PENDING_REVIEW";

  async function submitAudit(decision: "APPROVE" | "REJECT") {
    setBusy(decision === "APPROVE" ? "approve" : "reject");
    setMessage(null);
    try {
      if (decision === "REJECT" && notes.trim().length < 5) {
        throw new Error(copy.rejectNeedsNotes);
      }
      if (decision === "APPROVE") {
        if (!allChecked || notes.trim().length < 10) {
          throw new Error(copy.approveNeedsChecks);
        }
      }

      const response = await fetch(`/api/projects/${projectId}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: notes.trim(),
          checklist: checks,
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        data?: { status?: string };
        publishable?: boolean;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? copy.auditFailed ?? "Audit failed");
      }

      setStatus(payload.data?.status ?? status);
      setApproved(Boolean(payload.publishable));
      setMessage({
        tone: "success",
        text:
          decision === "APPROVE"
            ? copy.approvedReady
            : copy.rejectedToDraft ?? "Project rejected and returned to draft.",
      });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : copy.auditFailed ?? "Audit failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!canPublish) {
      setMessage({ tone: "error", text: copy.publishNeedsApprove });
      return;
    }
    setBusy("publish");
    setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/activate`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        message?: string;
        status?: string;
      };
      if (!response.ok) {
        throw new Error(
          payload.message ?? copy.publishFailed ?? "Publish failed",
        );
      }
      setStatus(payload.status ?? "PUBLISHED");
      setMessage({
        tone: "success",
        text: copy.published ?? "Project published.",
      });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : copy.publishFailed ?? "Publish failed",
      });
    } finally {
      setBusy(null);
    }
  }

  if (status === "PUBLISHED") {
    return null;
  }

  return (
    <section className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-deep">{copy.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{copy.lede}</p>
        </div>
        <p className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-amber-300">
          {copy.statusLabel}: {status}
        </p>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
            message.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setChecks(
              Object.fromEntries(
                CHECKLIST_KEYS.map((key) => [key, true]),
              ) as Record<ChecklistKey, boolean>,
            )
          }
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {copy.checkAll}
        </button>
        <button
          type="button"
          onClick={() =>
            setChecks(
              Object.fromEntries(
                CHECKLIST_KEYS.map((key) => [key, false]),
              ) as Record<ChecklistKey, boolean>,
            )
          }
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {copy.uncheckAll}
        </button>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {CHECKLIST_KEYS.map((key) => {
          const on = checks[key];
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() =>
                  setChecks((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  on
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {on ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span className="font-medium">{copy.checks[key]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <label className="mt-5 block">
        <span className="text-sm font-semibold text-slate-700">
          {copy.notesLabel}
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 shadow-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15"
          placeholder={copy.notesPlaceholder}
        />
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void submitAudit("APPROVE")}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45"
        >
          {busy === "approve" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : null}
          {busy === "approve" ? copy.saving : copy.approve}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void submitAudit("REJECT")}
          className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-45"
        >
          {busy === "reject" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : null}
          {busy === "reject" ? copy.saving : copy.reject}
        </button>
        {allowPublish ? (
          <button
            type="button"
            disabled={busy !== null || !canPublish}
            onClick={() => void publish()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-45"
          >
            {busy === "publish" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            {busy === "publish" ? copy.publishing : copy.publish}
          </button>
        ) : null}
      </div>
      {!allowPublish ? (
        <p className="mt-3 text-xs text-slate-500">
          {copy.publishAdminOnly ??
            "Publish is admin-only — your audit approval queues the project for an admin to publish."}
        </p>
      ) : null}
    </section>
  );
}
