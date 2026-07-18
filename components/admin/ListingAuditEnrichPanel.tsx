"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, UploadCloud } from "lucide-react";
import { ADDIS_SUB_CITY_CODES } from "@/lib/properties/subCities";

export type AuditEnrichCopy = {
  title: string;
  lede: string;
  filesLabel: string;
  filesHint: string;
  parseCta: string;
  parsing: string;
  applyCta: string;
  applying: string;
  photosLabel: string;
  photosHint: string;
  uploadPhotosCta: string;
  uploading: string;
  as360Label: string;
  pickDraft: string;
  applied: string;
  photosUploaded: string;
  needFiles: string;
  needDraft: string;
  parseFailed: string;
  applyFailed: string;
  uploadFailed: string;
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

type ListingAuditEnrichPanelProps = {
  listingId: string;
  copy: AuditEnrichCopy;
};

export function ListingAuditEnrichPanel({
  listingId,
  copy,
}: ListingAuditEnrichPanelProps) {
  const router = useRouter();
  const [kitFiles, setKitFiles] = useState<File[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [as360, setAs360] = useState(false);
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [selected, setSelected] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const draft = drafts[selected] ?? null;

  function updateDraft<K extends keyof ListingDraft>(
    key: K,
    value: ListingDraft[K],
  ) {
    setDrafts((prev) =>
      prev.map((row, index) =>
        index === selected ? { ...row, [key]: value } : row,
      ),
    );
  }

  async function parseFiles() {
    setMessage(null);
    if (kitFiles.length === 0) {
      setMessage({ tone: "error", text: copy.needFiles });
      return;
    }
    setParsing(true);
    try {
      const formData = new FormData();
      for (const file of kitFiles) formData.append("documents", file);
      const response = await fetch("/api/admin/sales-kits/parse", {
        method: "POST",
        body: formData,
      });
      const text = await response.text();
      let payload: {
        data?: { listings: ListingDraft[] };
        message?: string;
      } = {};
      try {
        payload = text ? (JSON.parse(text) as typeof payload) : {};
      } catch {
        throw new Error(text.slice(0, 160) || copy.parseFailed);
      }
      if (!response.ok) {
        throw new Error(payload.message ?? copy.parseFailed);
      }
      const listings = payload.data?.listings ?? [];
      if (listings.length === 0) {
        throw new Error(copy.parseFailed);
      }
      setDrafts(listings);
      setSelected(0);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : copy.parseFailed,
      });
    } finally {
      setParsing(false);
    }
  }

  async function applyDraft() {
    setMessage(null);
    if (!draft) {
      setMessage({ tone: "error", text: copy.needDraft });
      return;
    }
    setApplying(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/enrich`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? copy.applyFailed);
      }
      setMessage({ tone: "success", text: copy.applied });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : copy.applyFailed,
      });
    } finally {
      setApplying(false);
    }
  }

  async function uploadPhotos() {
    setMessage(null);
    if (photoFiles.length === 0) {
      setMessage({ tone: "error", text: copy.needFiles });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("kind", "UNIT_GALLERY");
      if (as360) formData.set("as360", "1");
      for (const file of photoFiles) formData.append("files", file);
      const response = await fetch(`/api/listings/${listingId}/media`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? copy.uploadFailed);
      }
      setPhotoFiles([]);
      setMessage({ tone: "success", text: copy.photosUploaded });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : copy.uploadFailed,
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900">{copy.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{copy.lede}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              {copy.filesLabel}
            </span>
            <input
              type="file"
              accept=".pdf,.docx,image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) =>
                setKitFiles(Array.from(event.target.files ?? []).slice(0, 3))
              }
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-800"
            />
            <span className="text-xs text-slate-500">{copy.filesHint}</span>
          </label>
          <button
            type="button"
            disabled={parsing || kitFiles.length === 0}
            onClick={() => void parseFiles()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {parsing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {parsing ? copy.parsing : copy.parseCta}
          </button>

          {drafts.length > 1 ? (
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-700">
                {copy.pickDraft}
              </span>
              <select
                value={selected}
                onChange={(event) => setSelected(Number(event.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {drafts.map((row, index) => (
                  <option key={`${row.title}-${index}`} value={index}>
                    {index + 1}. {row.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {draft ? (
            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <input
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
                aria-label="Title"
              />
              <textarea
                value={draft.description}
                onChange={(event) =>
                  updateDraft("description", event.target.value)
                }
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                aria-label="Description"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={draft.price}
                  onChange={(event) =>
                    updateDraft("price", Number(event.target.value) || 0)
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  aria-label="Price"
                />
                <select
                  value={draft.currency}
                  onChange={(event) =>
                    updateDraft(
                      "currency",
                      event.target.value as ListingDraft["currency"],
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="ETB">ETB</option>
                  <option value="USD">USD</option>
                </select>
                <select
                  value={draft.subCity}
                  onChange={(event) =>
                    updateDraft("subCity", event.target.value)
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {ADDIS_SUB_CITY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.listingType}
                  onChange={(event) =>
                    updateDraft(
                      "listingType",
                      event.target.value as ListingDraft["listingType"],
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="SALE">SALE</option>
                  <option value="RENT">RENT</option>
                  <option value="OFF_PLAN">OFF_PLAN</option>
                </select>
                <input
                  type="number"
                  value={draft.bedrooms}
                  onChange={(event) =>
                    updateDraft("bedrooms", Number(event.target.value) || 0)
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  aria-label="Bedrooms"
                />
                <input
                  type="number"
                  value={draft.bathrooms}
                  onChange={(event) =>
                    updateDraft("bathrooms", Number(event.target.value) || 0)
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  aria-label="Bathrooms"
                />
                <input
                  type="number"
                  value={draft.sizeM2}
                  onChange={(event) =>
                    updateDraft("sizeM2", Number(event.target.value) || 0)
                  }
                  className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  aria-label="Size m2"
                />
              </div>
              <button
                type="button"
                disabled={applying}
                onClick={() => void applyDraft()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {applying ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
                {applying ? copy.applying : copy.applyCta}
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              {copy.photosLabel}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) =>
                setPhotoFiles(Array.from(event.target.files ?? []).slice(0, 12))
              }
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-800"
            />
            <span className="text-xs text-slate-500">{copy.photosHint}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={as360}
              onChange={(event) => setAs360(event.target.checked)}
              className="rounded border-slate-300"
            />
            {copy.as360Label}
          </label>
          <button
            type="button"
            disabled={uploading || photoFiles.length === 0}
            onClick={() => void uploadPhotos()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {uploading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {uploading ? copy.uploading : copy.uploadPhotosCta}
          </button>
        </div>
      </div>

      {message ? (
        <p
          className={`mt-4 text-sm font-medium ${
            message.tone === "success" ? "text-emerald-700" : "text-rose-700"
          }`}
          role={message.tone === "error" ? "alert" : undefined}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
