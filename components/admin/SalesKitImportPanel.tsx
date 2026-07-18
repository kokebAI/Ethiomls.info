"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, UploadCloud } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ADDIS_SUB_CITY_CODES } from "@/lib/properties/subCities";

type RoleAccount = {
  userId: string;
  fullName: string;
  phone: string | null;
  role: "CORPORATE_DEVELOPER" | "INDEPENDENT_DELALA";
  label: string;
  registrationNumber: string | null;
  tradeName: string | null;
  listingCount: number;
};

type ListingDraft = {
  title: string;
  description: string;
  price: number;
  currency: "ETB" | "USD";
  subCity: string;
  addressLine?: string;
  bedrooms: number;
  bathrooms: number;
  sizeM2: number;
  floor?: number | null;
  unitLabel?: string | null;
  listingType: "SALE" | "RENT" | "OFF_PLAN";
  category: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | "LAND";
  projectName?: string | null;
};

export function SalesKitImportPanel() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<RoleAccount[]>([]);
  const [userId, setUserId] = useState("");
  const [createNew, setCreateNew] = useState(false);
  const [role, setRole] = useState<"CORPORATE_DEVELOPER" | "INDEPENDENT_DELALA">(
    "CORPORATE_DEVELOPER",
  );
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [meta, setMeta] = useState<{
    developerName?: string | null;
    projectName?: string | null;
  }>({});
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const response = await fetch("/api/admin/role-accounts");
      const payload = (await response.json()) as {
        data?: RoleAccount[];
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? t("salesKit.loadAccountsFailed"));
      }
      setAccounts(payload.data ?? []);
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("salesKit.loadAccountsFailed"),
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function parseFiles() {
    setMessage(null);
    if (files.length === 0) {
      setMessage({ tone: "error", text: t("salesKit.needFiles") });
      return;
    }
    setParsing(true);
    try {
      const formData = new FormData();
      for (const file of files) formData.append("documents", file);
      const response = await fetch("/api/admin/sales-kits/parse", {
        method: "POST",
        body: formData,
      });
      const text = await response.text();
      let payload: {
        data?: {
          listings: ListingDraft[];
          developerName?: string | null;
          projectName?: string | null;
        };
        fileNames?: string[];
        message?: string;
        error?: string;
      } = {};
      try {
        payload = text ? (JSON.parse(text) as typeof payload) : {};
      } catch {
        throw new Error(text.slice(0, 160) || t("salesKit.parseFailed"));
      }
      if (!response.ok || !payload.data?.listings?.length) {
        throw new Error(
          payload.message || payload.error || t("salesKit.parseFailed"),
        );
      }
      setDrafts(payload.data.listings);
      setMeta({
        developerName: payload.data.developerName,
        projectName: payload.data.projectName,
      });
      setFileNames(payload.fileNames ?? files.map((f) => f.name));
      if (payload.data.developerName && !tradeName) {
        setTradeName(payload.data.developerName);
      }
      setMessage({
        tone: "success",
        text: t("salesKit.parseDone", { count: payload.data.listings.length }),
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : t("salesKit.parseFailed"),
      });
    } finally {
      setParsing(false);
    }
  }

  async function importListings() {
    setMessage(null);
    if (drafts.length === 0) {
      setMessage({ tone: "error", text: t("salesKit.needDrafts") });
      return;
    }
    if (!createNew && !userId) {
      setMessage({ tone: "error", text: t("salesKit.needAccount") });
      return;
    }
    if (createNew && !phone.trim()) {
      setMessage({ tone: "error", text: t("salesKit.needPhone") });
      return;
    }

    setImporting(true);
    try {
      const response = await fetch("/api/admin/sales-kits/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(createNew
            ? {
                role,
                phone: phone.trim(),
                fullName: fullName.trim() || undefined,
                tradeName: tradeName.trim() || undefined,
                registrationNumber: registrationNumber.trim() || undefined,
              }
            : { userId }),
          sourceLabel: fileNames.join(", ") || "sales-kit",
          listings: drafts,
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        data?: { created?: number; accountCreated?: boolean };
      };
      if (!response.ok) {
        throw new Error(payload.message ?? t("salesKit.importFailed"));
      }
      setMessage({
        tone: "success",
        text: payload.message ?? t("salesKit.importDone"),
      });
      setDrafts([]);
      setFiles([]);
      await loadAccounts();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : t("salesKit.importFailed"),
      });
    } finally {
      setImporting(false);
    }
  }

  function updateDraft(index: number, patch: Partial<ListingDraft>) {
    setDrafts((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15";

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-lg font-semibold text-slate-deep">
        {t("salesKit.title")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{t("salesKit.lede")}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={createNew}
            onChange={(event) => setCreateNew(event.target.checked)}
          />
          {t("salesKit.createNew")}
        </label>

        {!createNew ? (
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              {t("salesKit.selectAccount")}
            </span>
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className={fieldClass}
              disabled={loadingAccounts}
            >
              <option value="">{t("salesKit.selectPlaceholder")}</option>
              {accounts.map((account) => (
                <option key={account.userId} value={account.userId}>
                  {account.label}
                  {account.phone ? ` · ${account.phone}` : ""} ·{" "}
                  {account.role === "CORPORATE_DEVELOPER"
                    ? t("salesKit.roleDeveloper")
                    : t("salesKit.roleBroker")}{" "}
                  ({account.listingCount})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              <span className="text-sm font-semibold text-slate-700">
                {t("salesKit.role")}
              </span>
              <select
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target.value as
                      | "CORPORATE_DEVELOPER"
                      | "INDEPENDENT_DELALA",
                  )
                }
                className={fieldClass}
              >
                <option value="CORPORATE_DEVELOPER">
                  {t("salesKit.roleDeveloper")}
                </option>
                <option value="INDEPENDENT_DELALA">
                  {t("salesKit.roleBroker")}
                </option>
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">
                {t("salesKit.phone")}
              </span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={fieldClass}
                placeholder="+2519… or 09…"
              />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">
                {t("salesKit.fullName")}
              </span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={fieldClass}
              />
            </label>
            {role === "CORPORATE_DEVELOPER" ? (
              <>
                <label>
                  <span className="text-sm font-semibold text-slate-700">
                    {t("salesKit.tradeName")}
                  </span>
                  <input
                    value={tradeName}
                    onChange={(event) => setTradeName(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {t("salesKit.registration")}
                  </span>
                  <input
                    value={registrationNumber}
                    onChange={(event) =>
                      setRegistrationNumber(event.target.value)
                    }
                    className={fieldClass}
                    placeholder="ET-DIR-… (optional)"
                  />
                </label>
              </>
            ) : null}
          </>
        )}

        <label className="sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            {t("salesKit.files")}
          </span>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
            className={`${fieldClass} file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-300`}
            onChange={(event) =>
              setFiles(Array.from(event.target.files ?? []).slice(0, 3))
            }
          />
          <p className="mt-1 text-xs text-ink-muted">{t("salesKit.filesHint")}</p>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={parsing || files.length === 0}
          onClick={() => void parseFiles()}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-45"
        >
          {parsing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          {parsing ? t("salesKit.parsing") : t("salesKit.parseCta")}
        </button>
        <button
          type="button"
          disabled={importing || drafts.length === 0}
          onClick={() => void importListings()}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-45"
        >
          {importing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : null}
          {importing ? t("salesKit.importing") : t("salesKit.importCta")}
        </button>
      </div>

      {meta.projectName || meta.developerName ? (
        <p className="mt-3 text-xs text-ink-muted">
          {meta.developerName ? `${meta.developerName}` : ""}
          {meta.developerName && meta.projectName ? " · " : ""}
          {meta.projectName ?? ""}
        </p>
      ) : null}

      {message ? (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
            message.tone === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {drafts.length > 0 ? (
        <ul className="mt-5 grid gap-3">
          {drafts.map((draft, index) => (
            <li
              key={`${draft.title}-${index}`}
              className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("salesKit.draftTitle")}
                  </span>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      updateDraft(index, { title: event.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("salesKit.draftPrice")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={draft.price}
                    onChange={(event) =>
                      updateDraft(index, {
                        price: Number(event.target.value) || 0,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("salesKit.draftSubCity")}
                  </span>
                  <select
                    value={draft.subCity}
                    onChange={(event) =>
                      updateDraft(index, { subCity: event.target.value })
                    }
                    className={fieldClass}
                  >
                    {ADDIS_SUB_CITY_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("salesKit.draftDescription")}
                  </span>
                  <textarea
                    rows={2}
                    value={draft.description}
                    onChange={(event) =>
                      updateDraft(index, { description: event.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {draft.listingType} · {draft.category}
                {draft.sizeM2 ? ` · ${draft.sizeM2} m²` : ""}
                {draft.unitLabel ? ` · ${draft.unitLabel}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
