"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { LoaderCircle, ScanLine, Sparkles, UploadCloud, X } from "lucide-react";
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

/** Stay under Vercel’s 4.5 MB function body limit (multipart overhead included). */
const MAX_FILE_BYTES = 2.5 * 1024 * 1024;
const MAX_FILES = 10;
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shrink large phone photos before upload so they fit the serverless body limit. */
async function prepareFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= MAX_FILE_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.72);
    });
    if (!blob || blob.size === 0) return file;

    const compressed = new File(
      [blob],
      file.name.replace(/\.\w+$/, ".jpg"),
      { type: "image/jpeg", lastModified: Date.now() },
    );
    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}

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

type ParsedPayload = {
  title: string;
  price: number;
  currency?: "ETB" | "USD";
  subCity: string;
  bedrooms: number;
  bathrooms: number;
  sizeM2?: number;
  description: string;
  addressLine?: string;
  listingType?: FormValues["listingType"];
  propertyType?: FormValues["propertyType"];
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

function preferText(current: string, next: string): string {
  const a = current.trim();
  const b = next.trim();
  if (!b) return a;
  if (!a) return b;
  return b.length > a.length ? b : a;
}

function mergeParsed(parts: ParsedPayload[]): ParsedPayload {
  const base: ParsedPayload = {
    title: "",
    price: 0,
    currency: "ETB",
    subCity: "",
    bedrooms: 0,
    bathrooms: 0,
    sizeM2: 0,
    description: "",
    addressLine: "",
    listingType: "SALE",
    propertyType: "RESIDENTIAL",
  };

  const descriptions: string[] = [];

  for (const part of parts) {
    base.title = preferText(base.title, part.title);
    if (part.price > base.price) base.price = part.price;
    if (part.currency) base.currency = part.currency;
    base.subCity = preferText(base.subCity, part.subCity);
    if (part.bedrooms > base.bedrooms) base.bedrooms = part.bedrooms;
    if (part.bathrooms > base.bathrooms) base.bathrooms = part.bathrooms;
    if ((part.sizeM2 ?? 0) > (base.sizeM2 ?? 0)) base.sizeM2 = part.sizeM2 ?? 0;
    base.addressLine = preferText(base.addressLine ?? "", part.addressLine ?? "");
    if (part.listingType) base.listingType = part.listingType;
    if (part.propertyType) base.propertyType = part.propertyType;
    if (part.description.trim()) descriptions.push(part.description.trim());
  }

  base.description = [...new Set(descriptions)].join("\n\n");
  return base;
}

async function readJsonSafe(response: Response): Promise<{
  data?: ParsedPayload;
  error?: string;
  message?: string;
}> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as {
      data?: ParsedPayload;
      error?: string;
      message?: string;
    };
  } catch {
    if (
      /request entity too large|FUNCTION_PAYLOAD_TOO_LARGE|413/i.test(text) ||
      response.status === 413
    ) {
      return {
        error:
          "Upload is too large for the server. Use files under 2.5 MB (photos are compressed automatically).",
      };
    }
    return {
      error:
        text.slice(0, 160).trim() ||
        "Unexpected server response while parsing documents.",
    };
  }
}

export function PropertyForm({ ownerId, onCreated }: PropertyFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [propertyId, setPropertyId] = useState("");
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentNames, setDocumentNames] = useState<string[]>([]);
  const [parseProgress, setParseProgress] = useState("");
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

  function applyParsed(data: ParsedPayload) {
    setValues((current) => ({
      ...current,
      title: data.title || current.title,
      price: data.price > 0 ? String(data.price) : current.price,
      currency: data.currency ?? current.currency,
      subCity: data.subCity || current.subCity,
      bedrooms: String(data.bedrooms),
      bathrooms: String(data.bathrooms),
      sizeM2:
        data.sizeM2 && data.sizeM2 > 0 ? String(data.sizeM2) : current.sizeM2,
      description: data.description || current.description,
      addressLine: data.addressLine || current.addressLine,
      listingType: data.listingType ?? current.listingType,
      propertyType: data.propertyType ?? current.propertyType,
    }));
  }

  async function parseDocuments(fileList: File[]) {
    setMessage(null);

    const files = Array.from(fileList).slice(0, MAX_FILES);
    if (files.length === 0) return;

    const invalidType = files.find((file) => !isAcceptedFile(file));
    if (invalidType) {
      setMessage({
        tone: "error",
        text: `${invalidType.name}: only PDF, JPEG, PNG, and WebP are supported.`,
      });
      return;
    }

    const empty = files.find((file) => file.size === 0);
    if (empty) {
      setMessage({
        tone: "error",
        text: `${empty.name} is empty.`,
      });
      return;
    }

    setDocumentNames(files.map((file) => file.name));
    setIsParsing(true);

    try {
      const prepared: File[] = [];
      for (const file of files) {
        setParseProgress(`Preparing ${file.name}...`);
        const next = await prepareFileForUpload(file);
        if (next.size > MAX_FILE_BYTES) {
          throw new Error(
            `${file.name} is still ${formatMb(next.size)} after compression. Use a file under 2.5 MB.`,
          );
        }
        prepared.push(next);
      }

      const parsedParts: ParsedPayload[] = [];

      for (let i = 0; i < prepared.length; i += 1) {
        const file = prepared[i]!;
        setParseProgress(
          `Parsing ${i + 1} of ${prepared.length}: ${file.name}...`,
        );

        const formData = new FormData();
        formData.append("documents", file);

        const response = await fetch("/api/properties/parse", {
          method: "POST",
          body: formData,
        });
        const payload = await readJsonSafe(response);

        if (!response.ok || !payload.data) {
          throw new Error(
            payload.error ||
              payload.message ||
              "Document parsing failed.",
          );
        }

        parsedParts.push(payload.data);
      }

      const merged = mergeParsed(parsedParts);
      applyParsed(merged);
      setMessage({
        tone: "success",
        text:
          files.length === 1
            ? "Document parsed. Review the details before submitting."
            : `${files.length} documents parsed and merged. Review the details before submitting.`,
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
      setParseProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) void parseDocuments(files);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      let id = propertyId || generatePropertyId();
      if (!propertyId) setPropertyId(id);

      const body = {
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
        metadata: [
          "document-assisted-submission",
          ...(documentNames.length > 0
            ? [`docs:${documentNames.length}`]
            : []),
        ],
        ...(values.addressLine ? { addressLine: values.addressLine } : {}),
      };

      let response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let text = await response.text();
      let payload: { data?: { id: string }; error?: string; message?: string } =
        {};
      try {
        payload = text ? (JSON.parse(text) as typeof payload) : {};
      } catch {
        throw new Error(
          text.slice(0, 160).trim() || "Property could not be submitted.",
        );
      }

      // If the client-chosen ID raced with another listing, mint a new one and retry once.
      if (
        !response.ok &&
        payload.error === "PropertyIdCollision"
      ) {
        id = generatePropertyId();
        setPropertyId(id);
        response = await fetch("/api/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, id }),
        });
        text = await response.text();
        try {
          payload = text ? (JSON.parse(text) as typeof payload) : {};
        } catch {
          throw new Error(
            text.slice(0, 160).trim() || "Property could not be submitted.",
          );
        }
      }

      if (!response.ok || !payload.data) {
        throw new Error(
          payload.message ||
            payload.error ||
            "Property could not be submitted.",
        );
      }

      setPropertyId(payload.data.id);
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
          Upload one or more deeds, brochures, or listing sheets to prefill the
          form, then review every value before submission.
        </p>
      </header>

      <div className="space-y-8 p-6 sm:p-10">
        <section className="space-y-3">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload property documents or scan deeds"
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
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) void parseDocuments(files);
              }}
            />
            {isParsing ? (
              <>
                <LoaderCircle className="mb-4 h-10 w-10 animate-spin text-amber-600" />
                <p className="font-semibold text-slate-950">
                  Gemini is parsing your documents...
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {parseProgress || documentNames.join(", ")}
                </p>
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
                  Upload property documents / scan deeds
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Drop multiple PDF, JPEG, PNG, or WebP files · up to {MAX_FILES}{" "}
                  files · photos auto-compress · max {formatMb(MAX_FILE_BYTES)} each
                </p>
              </>
            )}
          </div>

          {documentNames.length > 0 && !isParsing ? (
            <ul className="flex flex-wrap gap-2">
              {documentNames.map((name) => (
                <li
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    onClick={() =>
                      setDocumentNames((current) =>
                        current.filter((item) => item !== name),
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
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
