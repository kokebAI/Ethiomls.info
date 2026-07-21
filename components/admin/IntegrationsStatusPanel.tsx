"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import type { IntegrationStatus } from "@/lib/ops/integration-status";

function StatusDot({ state }: { state: IntegrationStatus["state"] }) {
  const color =
    state === "ok"
      ? "bg-emerald-500"
      : state === "warn"
        ? "bg-amber-500"
        : state === "error"
          ? "bg-rose-500"
          : "bg-slate-400";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
      aria-hidden
    />
  );
}

export type OpsQueueChip = {
  id: string;
  label: string;
  href?: string;
  ok: boolean;
};

type IntegrationsStatusPanelProps = {
  initialIntegrations: IntegrationStatus[];
  opsChips: OpsQueueChip[];
  title: string;
  opsTitle: string;
  refreshLabel: string;
  refreshingLabel: string;
  headerAction?: ReactNode;
};

export function IntegrationsStatusPanel({
  initialIntegrations,
  opsChips,
  title,
  opsTitle,
  refreshLabel,
  refreshingLabel,
  headerAction,
}: IntegrationsStatusPanelProps) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/admin/integrations-status", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as {
          integrations?: IntegrationStatus[];
        };
        if (!Array.isArray(body.integrations)) {
          throw new Error("Invalid response");
        }
        setIntegrations(body.integrations);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Refresh failed");
      }
    });
  }

  return (
    <section
      className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-[var(--shadow-card)] sm:p-5"
      aria-labelledby="admin-services-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="admin-services-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500"
        >
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {headerAction}
          <button
            type="button"
            onClick={refresh}
            disabled={isPending}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
          >
            {isPending ? refreshingLabel : refreshLabel}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {integrations.map((item) => (
          <li
            key={item.id}
            title={`${item.label}: ${item.detail}`}
            className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5"
          >
            <StatusDot state={item.state} />
            <span className="min-w-0 truncate">
              <span className="block truncate text-[11px] font-semibold leading-tight text-slate-800">
                {item.label}
              </span>
              <span className="block truncate text-[10px] leading-tight text-ink-muted">
                {item.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {opsTitle}
      </p>
      <ul className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        {opsChips.map((chip) => {
          const inner = (
            <>
              <StatusDot state={chip.ok ? "ok" : "warn"} />
              <span className="min-w-0 truncate text-[11px] font-semibold leading-tight text-slate-800">
                {chip.label}
              </span>
            </>
          );
          return (
            <li key={chip.id} className="min-w-0">
              {chip.href ? (
                <a
                  href={chip.href}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 hover:border-brand-200 hover:bg-brand-50/40"
                >
                  {inner}
                </a>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5">
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
