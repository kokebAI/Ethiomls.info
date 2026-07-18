"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  CheckCircle2,
  Circle,
  LoaderCircle,
  ScanLine,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { CONSTRUCTION_STAGE_OPTIONS } from "@/lib/domain/construction-stage";
import {
  EVIDENCE_KIND_LABELS,
  MIN_GALLERY_PHOTOS,
  requiredEvidenceKindsForHoldType,
} from "@/lib/properties/evidence";
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

type EvidenceKind =
  | ReturnType<typeof requiredEvidenceKindsForHoldType>[number]
  | "UNIT_GALLERY";

type StagedEvidence = {
  id: string;
  kind: EvidenceKind;
  fileName: string;
  publicUrl: string;
};

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
  constructionStage: string;
  escrowAccountNumber: string;
  bankEscrowProvider: string;
  constructionPermitId: string;
  constructionPermitVerified: boolean;
  tradeName: string;
  registrationNumber: string;
  landHoldType: "FREEHOLD" | "LEASEHOLD";
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
  constructionStage?: string;
  escrowAccountNumber?: string;
  bankEscrowProvider?: string;
  constructionPermitId?: string;
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
  constructionStage: "SUPERSTRUCTURE",
  escrowAccountNumber: "",
  bankEscrowProvider: "",
  constructionPermitId: "",
  constructionPermitVerified: false,
  tradeName: "",
  registrationNumber: "",
  landHoldType: "FREEHOLD",
};

export type PropertyFormProps = {
  ownerId: string;
  role?: string | null;
  hasFayda?: boolean;
  hasDeveloperProfile?: boolean;
  developerTin?: string | null;
  projectOptions?: { id: string; title: string }[];
  defaultListingType?: FormValues["listingType"];
  allowOffPlan?: boolean;
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
    if (part.constructionStage) base.constructionStage = part.constructionStage;
    if (part.escrowAccountNumber)
      base.escrowAccountNumber = preferText(
        base.escrowAccountNumber ?? "",
        part.escrowAccountNumber,
      );
    if (part.bankEscrowProvider)
      base.bankEscrowProvider = preferText(
        base.bankEscrowProvider ?? "",
        part.bankEscrowProvider,
      );
    if (part.constructionPermitId)
      base.constructionPermitId = preferText(
        base.constructionPermitId ?? "",
        part.constructionPermitId,
      );
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

export function PropertyForm({
  ownerId,
  role,
  hasFayda: hasFaydaProp = false,
  hasDeveloperProfile = false,
  developerTin = null,
  projectOptions = [],
  defaultListingType,
  allowOffPlan = false,
  onCreated,
}: PropertyFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [propertyId, setPropertyId] = useState("");
  const [values, setValues] = useState<FormValues>(() => ({
    ...EMPTY_FORM,
    listingType: defaultListingType ?? EMPTY_FORM.listingType,
  }));
  const [projectId, setProjectId] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [documentNames, setDocumentNames] = useState<string[]>([]);
  const [parseProgress, setParseProgress] = useState("");
  const [evidence, setEvidence] = useState<StagedEvidence[]>([]);
  const [hasFayda, setHasFayda] = useState(hasFaydaProp);
  const [faydaBusy, setFaydaBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const isDeveloper = role === "CORPORATE_DEVELOPER";
  const needsFullPack = isDeveloper && values.listingType === "OFF_PLAN";

  useEffect(() => {
    setPropertyId(generatePropertyId());
  }, []);

  useEffect(() => {
    setHasFayda(hasFaydaProp);
  }, [hasFaydaProp]);

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
      constructionStage: data.constructionStage || current.constructionStage,
      escrowAccountNumber:
        data.escrowAccountNumber || current.escrowAccountNumber,
      bankEscrowProvider: data.bankEscrowProvider || current.bankEscrowProvider,
      constructionPermitId:
        data.constructionPermitId || current.constructionPermitId,
      constructionPermitVerified: data.constructionPermitId
        ? /^MUD-CP-\d{4}-\d{5}$/i.test(data.constructionPermitId)
        : current.constructionPermitVerified,
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
        text: "Only PDF, JPEG, PNG, and WebP are supported.",
      });
      return;
    }

    setIsParsing(true);
    setDocumentNames(files.map((file) => file.name));
    const parsedParts: ParsedPayload[] = [];

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = await prepareFileForUpload(files[index]);
        if (file.size > MAX_FILE_BYTES) {
          throw new Error(
            `${files[index].name} is still over ${formatMb(MAX_FILE_BYTES)} after compression.`,
          );
        }
        setParseProgress(`Parsing ${index + 1} of ${files.length}…`);
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
              `Could not parse ${files[index].name}`,
          );
        }
        parsedParts.push(payload.data);
      }

      applyParsed(mergeParsed(parsedParts));
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
          error instanceof Error ? error.message : "Document parsing failed.",
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

  async function uploadEvidence(kind: EvidenceKind, file: File) {
    setMessage(null);
    setUploadingKind(kind);
    try {
      const prepared = await prepareFileForUpload(file);
      if (prepared.size > MAX_FILE_BYTES) {
        throw new Error(`File must be under ${formatMb(MAX_FILE_BYTES)}`);
      }
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("file", prepared);
      const response = await fetch("/api/properties/evidence", {
        method: "POST",
        body: formData,
      });
      const text = await response.text();
      const payload = text
        ? (JSON.parse(text) as {
            data?: StagedEvidence;
            error?: string;
            message?: string;
          })
        : {};
      if (!response.ok || !payload.data) {
        throw new Error(payload.message || payload.error || "Upload failed");
      }
      setEvidence((current) => {
        const next =
          kind === "UNIT_GALLERY"
            ? current
            : current.filter((item) => item.kind !== kind);
        return [...next, payload.data!];
      });
      // Also run AI parse for document kinds
      if (kind !== "UNIT_GALLERY") {
        void parseDocuments([prepared]);
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setUploadingKind(null);
    }
  }

  async function verifyFayda() {
    setFaydaBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/fayda/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        live?: boolean;
        authorizeUrl?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || payload.error || "Fayda failed");
      }
      if (payload.live && payload.authorizeUrl) {
        window.location.href = payload.authorizeUrl;
        return;
      }
      setHasFayda(true);
      setMessage({
        tone: "success",
        text:
          payload.message ||
          "Demo Fayda verification complete.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Fayda verification failed",
      });
    } finally {
      setFaydaBusy(false);
    }
  }

  function hasKind(kind: EvidenceKind) {
    return evidence.some((item) => item.kind === kind);
  }

  const requiredDocKinds = requiredEvidenceKindsForHoldType({
    holdType: values.landHoldType,
    skipTin: Boolean(developerTin),
  });

  const galleryCount = evidence.filter((e) => e.kind === "UNIT_GALLERY").length;
  const checklistComplete =
    !needsFullPack ||
    (requiredDocKinds.every((kind) => hasKind(kind)) &&
      galleryCount >= MIN_GALLERY_PHOTOS &&
      hasFayda &&
      (hasDeveloperProfile ||
        (values.tradeName.trim().length >= 2 &&
          values.registrationNumber.trim().length >= 2)) &&
      values.escrowAccountNumber.trim() &&
      values.bankEscrowProvider.trim() &&
      values.constructionPermitId.trim() &&
      values.constructionPermitVerified);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (needsFullPack && !checklistComplete) {
      setMessage({
        tone: "error",
        text: "Complete the developer checklist (documents, photos, Fayda, and escrow fields) before submitting.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let id = propertyId || generatePropertyId();
      if (!propertyId) setPropertyId(id);

      const body: Record<string, unknown> = {
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
          ...(needsFullPack ? ["developer-full-pack"] : []),
        ],
        ...(values.addressLine ? { addressLine: values.addressLine } : {}),
      };

      if (values.listingType === "OFF_PLAN" || needsFullPack) {
        body.constructionStage = values.constructionStage;
        body.escrowAccountNumber = values.escrowAccountNumber.trim();
        body.bankEscrowProvider = values.bankEscrowProvider.trim();
        body.constructionPermitId = values.constructionPermitId.trim();
        body.constructionPermitVerified = values.constructionPermitVerified;
        body.isUnfinished = true;
        body.landHoldType = values.landHoldType;
      }

      if (needsFullPack) {
        body.evidenceUploadIds = evidence.map((item) => item.id);
        if (!hasDeveloperProfile) {
          body.tradeName = values.tradeName.trim();
          body.registrationNumber = values.registrationNumber.trim();
        }
        if (projectId) body.projectId = projectId;
      }

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

      if (!response.ok && payload.error === "PropertyIdCollision") {
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

      setMessage({
        tone: "success",
        text: `Submitted ${payload.data.id} for admin review.`,
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
          {needsFullPack ? "Submit off-plan inventory" : "Submit a property"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          {needsFullPack
            ? "Upload the full developer pack (org docs, floor plan, title/lease, permit, escrow, photos), verify Fayda, then review fields before submit."
            : "Upload deeds, brochures, or listing sheets to prefill the form, then review every value before submission."}
        </p>
      </header>

      <div className="space-y-8 p-6 sm:p-10">
        {needsFullPack ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Required checklist
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                PDF, JPEG, PNG, or WebP · max {formatMb(MAX_FILE_BYTES)} each ·
                at least {MIN_GALLERY_PHOTOS} photos
              </p>
            </div>
            <ul className="space-y-3">
              {requiredDocKinds.map((kind) => {
                const done = hasKind(kind);
                return (
                  <li
                    key={kind}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-300" />
                      )}
                      {EVIDENCE_KIND_LABELS[kind]}
                      {done
                        ? ` · ${evidence.find((e) => e.kind === kind)?.fileName}`
                        : ""}
                    </span>
                    <label className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      {uploadingKind === kind ? "Uploading…" : "Upload"}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={Boolean(uploadingKind)}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadEvidence(kind, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </li>
                );
              })}
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                  {galleryCount >= MIN_GALLERY_PHOTOS ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                  Unit / project photos ({galleryCount}/{MIN_GALLERY_PHOTOS})
                </span>
                <label className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  {uploadingKind === "UNIT_GALLERY" ? "Uploading…" : "Add photos"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    disabled={Boolean(uploadingKind)}
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      void (async () => {
                        for (const file of files.slice(0, 12 - galleryCount)) {
                          await uploadEvidence("UNIT_GALLERY", file);
                        }
                      })();
                      event.target.value = "";
                    }}
                  />
                </label>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                  {hasFayda ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                  Fayda eSignet (company rep)
                </span>
                <button
                  type="button"
                  disabled={hasFayda || faydaBusy}
                  onClick={() => void verifyFayda()}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {hasFayda
                    ? "Verified"
                    : faydaBusy
                      ? "Verifying…"
                      : "Verify with Fayda"}
                </button>
              </li>
            </ul>
            {!hasDeveloperProfile ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>Trade name</span>
                  <input
                    required={needsFullPack}
                    value={values.tradeName}
                    onChange={(event) => update("tradeName", event.target.value)}
                    className={fieldClass}
                    placeholder="Sunshine Homes PLC"
                  />
                </label>
                <label>
                  <span className={labelClass}>Registration number</span>
                  <input
                    required={needsFullPack}
                    value={values.registrationNumber}
                    onChange={(event) =>
                      update("registrationNumber", event.target.value)
                    }
                    className={fieldClass}
                    placeholder="ET-DEV-…"
                  />
                </label>
              </div>
            ) : null}
            {projectOptions.length > 0 ? (
              <label>
                <span className={labelClass}>Link to project (optional)</span>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">No project link</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </section>
        ) : (
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
                    Drop multiple PDF, JPEG, PNG, or WebP files · up to{" "}
                    {MAX_FILES} files · photos auto-compress · max{" "}
                    {formatMb(MAX_FILE_BYTES)} each
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
        )}

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
              {allowOffPlan ? (
                <option value="OFF_PLAN">Off plan</option>
              ) : null}
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

          {values.listingType === "OFF_PLAN" ? (
            <>
              <label>
                <span className={labelClass}>Land hold type</span>
                <select
                  value={values.landHoldType}
                  onChange={(event) =>
                    update(
                      "landHoldType",
                      event.target.value as FormValues["landHoldType"],
                    )
                  }
                  className={fieldClass}
                >
                  <option value="FREEHOLD">Freehold (title deed)</option>
                  <option value="LEASEHOLD">Leasehold (lease agreement)</option>
                </select>
              </label>
              <label>
                <span className={labelClass}>Construction stage</span>
                <select
                  value={values.constructionStage}
                  onChange={(event) =>
                    update("constructionStage", event.target.value)
                  }
                  className={fieldClass}
                >
                  {CONSTRUCTION_STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Escrow account number</span>
                <input
                  required
                  value={values.escrowAccountNumber}
                  onChange={(event) =>
                    update("escrowAccountNumber", event.target.value)
                  }
                  className={fieldClass}
                  placeholder="Closed-bank escrow account"
                />
              </label>
              <label>
                <span className={labelClass}>Escrow bank</span>
                <input
                  required
                  value={values.bankEscrowProvider}
                  onChange={(event) =>
                    update("bankEscrowProvider", event.target.value)
                  }
                  className={fieldClass}
                  placeholder="e.g. Commercial Bank of Ethiopia"
                />
              </label>
              <label>
                <span className={labelClass}>
                  Construction permit (MUD-CP-YYYY-NNNNN)
                </span>
                <input
                  required
                  value={values.constructionPermitId}
                  onChange={(event) =>
                    update("constructionPermitId", event.target.value)
                  }
                  className={fieldClass}
                  placeholder="MUD-CP-2025-00042"
                />
              </label>
              <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={values.constructionPermitVerified}
                  onChange={(event) =>
                    update("constructionPermitVerified", event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-slate-800">
                  Permit ID is verified (Proc. 1357 / MUD serial)
                </span>
              </label>
            </>
          ) : null}

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
          disabled={
            isParsing ||
            isSubmitting ||
            !propertyId ||
            Boolean(uploadingKind) ||
            (needsFullPack && !checklistComplete)
          }
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
