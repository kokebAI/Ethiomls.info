"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { LoaderCircle, ScanLine, Sparkles, UploadCloud } from "lucide-react";
import { generatePropertyId } from "@/src/utils/generateId";

const SUB_CITIES = [
  ["addis-ketema", "Addis Ketema"],
  ["akaky-kaliti", "Akaky Kaliti"],
  ["arada", "Arada"],
  ["bole", "Bole"],
  ["gullele", "Gullele"],
  ["kirkos", "Kirkos"],
  ["kolfe-keranio", "Kolfe Keranio"],
  ["lideta", "Lideta"],
  ["nifas-silk-lafto", "Nifas Silk-Lafto"],
  ["yeka", "Yeka"],
  ["lemi-kura", "Lemi Kura"],
] as const;

type FormValues = {
  title: string;
  price: string;
  currency: "ETB" | "USD";
  subCity: string;
  bedrooms: string;
  bathrooms: string;
  sizeM2: string;
  description: string;
  addressLine: string;
  listingType: "SALE" | "RENT" | "OFF_PLAN";
  propertyType: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | "LAND";
};

const EMPTY_FORM: FormValues = {
  title: "",
  price: "",
  currency: "ETB",
  subCity: "",
  bedrooms: "0",
  bathrooms: "0",
  sizeM2: "",
  description: "",
  addressLine: "",
  listingType: "SALE",
  propertyType: "RESIDENTIAL",
};

type PropertyFormProps = {
  ownerId: string;
  onCreated?: (propertyId: string) => void;
};

export function PropertyForm({ ownerId, onCreated }: PropertyFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [propertyId, setPropertyId] = useState("");
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setPropertyId(generatePropertyId());
  }, []);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function parseDocument(file: File) {
    setMessage(null);
    setDocumentName(file.name);
    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.set("document", file);
      const response = await fetch("/api/properties/parse", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        data?: {
          title: string;
          price: number;
          subCity: string;
          bedrooms: number;
          bathrooms: number;
          description: string;
        };
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Document parsing failed.");
      }

      setValues((current) => ({
        ...current,
        title: payload.data!.title,
        price: payload.data!.price > 0 ? String(payload.data!.price) : current.price,
        subCity: payload.data!.subCity,
        bedrooms: String(payload.data!.bedrooms),
        bathrooms: String(payload.data!.bathrooms),
        description: payload.data!.description,
      }));
      setMessage({
        tone: "success",
        text: "Document parsed. Review the highlighted details before submitting.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Document parsing failed. Enter the details manually.",
      });
    } finally {
      setIsParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void parseDocument(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    const id = propertyId || generatePropertyId();
    if (!propertyId) setPropertyId(id);

    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ownerId,
          title: { en: values.title },
          description: { en: values.description },
          listingType: values.listingType,
          propertyType: values.propertyType,
          subCity: values.subCity,
          price: Number(values.price),
          currency: values.currency,
          bedrooms: Number(values.bedrooms),
          bathrooms: Number(values.bathrooms),
          sizeM2: Number(values.sizeM2),
          metadata: ["document-assisted-submission"],
          ...(values.addressLine ? { addressLine: values.addressLine } : {}),
        }),
      });
      const payload = (await response.json()) as {
        data?: { id: string };
        message?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.message || "Property could not be submitted.");
      }

      setMessage({
        tone: "success",
        text: `Property ${payload.data.id} was submitted successfully.`,
      });
      onCreated?.(payload.data.id);
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Property submission failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15";
  const labelClass = "text-sm font-semibold text-slate-700";

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/10"
    >
      <header className="bg-slate-950 px-6 py-7 text-white sm:px-10">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
          <Sparkles className="h-4 w-4" />
          AI-assisted listing
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Submit a property
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Scan a deed or listing sheet to prefill the form, then review every
          value before submission.
        </p>
      </header>

      <div className="space-y-8 p-6 sm:p-10">
        <section>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload Property Document or Scan Deed"
            onClick={() => !isParsing && inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                inputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`group flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
              isDragging
                ? "border-amber-500 bg-amber-50"
                : "border-slate-300 bg-slate-50 hover:border-amber-500 hover:bg-amber-50/50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void parseDocument(file);
              }}
            />
            {isParsing ? (
              <>
                <LoaderCircle className="mb-4 h-10 w-10 animate-spin text-amber-600" />
                <p className="font-semibold text-slate-950">
                  Gemini is parsing your document...
                </p>
                <p className="mt-1 text-sm text-slate-500">{documentName}</p>
              </>
            ) : (
              <>
                <span className="mb-4 rounded-2xl bg-slate-950 p-3 text-amber-400 shadow-lg">
                  {isDragging ? (
                    <UploadCloud className="h-7 w-7" />
                  ) : (
                    <ScanLine className="h-7 w-7" />
                  )}
                </span>
                <p className="font-semibold text-slate-950">
                  Upload Property Document / Scan Deed
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Drop a PDF, JPEG, PNG, or WebP here · maximum 10 MB
                </p>
              </>
            )}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Review property details
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <section className="grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Property ID</span>
            <input
              value={propertyId}
              readOnly
              aria-label="Generated property ID"
              className={`${fieldClass} font-mono font-bold tracking-[0.25em] text-amber-700`}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Title</span>
            <input
              required
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              className={fieldClass}
              placeholder="Modern apartment in Bole"
            />
          </label>
          <label>
            <span className={labelClass}>Price</span>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={values.price}
              onChange={(event) => update("price", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label>
            <span className={labelClass}>Currency</span>
            <select
              value={values.currency}
              onChange={(event) =>
                update("currency", event.target.value as FormValues["currency"])
              }
              className={fieldClass}
            >
              <option value="ETB">ETB</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Sub-city</span>
            <select
              required
              value={values.subCity}
              onChange={(event) => update("subCity", event.target.value)}
              className={fieldClass}
            >
              <option value="">Select a sub-city</option>
              {SUB_CITIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Address</span>
            <input
              value={values.addressLine}
              onChange={(event) => update("addressLine", event.target.value)}
              className={fieldClass}
              placeholder="Street or landmark"
            />
          </label>
          <label>
            <span className={labelClass}>Bedrooms</span>
            <input
              required
              type="number"
              min="0"
              value={values.bedrooms}
              onChange={(event) => update("bedrooms", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label>
            <span className={labelClass}>Bathrooms</span>
            <input
              required
              type="number"
              min="0"
              value={values.bathrooms}
              onChange={(event) => update("bathrooms", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label>
            <span className={labelClass}>Size (m²)</span>
            <input
              required
              type="number"
              min="1"
              step="1"
              value={values.sizeM2}
              onChange={(event) => update("sizeM2", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label>
            <span className={labelClass}>Listing type</span>
            <select
              value={values.listingType}
              onChange={(event) =>
                update(
                  "listingType",
                  event.target.value as FormValues["listingType"],
                )
              }
              className={fieldClass}
            >
              <option value="SALE">For sale</option>
              <option value="RENT">For rent</option>
              <option value="OFF_PLAN">Off plan</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Property type</span>
            <select
              value={values.propertyType}
              onChange={(event) =>
                update(
                  "propertyType",
                  event.target.value as FormValues["propertyType"],
                )
              }
              className={fieldClass}
            >
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="MIXED_USE">Mixed use</option>
              <option value="LAND">Land</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Description</span>
            <textarea
              required
              rows={6}
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              className={fieldClass}
              placeholder="Property features, condition, and location details"
            />
          </label>
        </section>

        {message ? (
          <p
            role="status"
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              message.tone === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isParsing || isSubmitting || !propertyId}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="h-5 w-5 animate-spin text-amber-400" />
              Submitting property...
            </>
          ) : (
            "Submit property"
          )}
        </button>
      </div>
    </form>
  );
}

export default PropertyForm;
