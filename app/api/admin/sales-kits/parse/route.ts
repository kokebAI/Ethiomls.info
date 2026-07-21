import { NextResponse } from "next/server";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import {
  isAcceptedSalesKitMime,
  parseSalesKitFiles,
  resolveSalesKitMime,
  SALES_KIT_MAX_BYTES,
  SALES_KIT_MAX_FILES,
} from "@/lib/imports/sales-kit-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

function collectFiles(formData: FormData): File[] {
  const files: File[] = [];
  for (const key of ["documents", "document", "file", "files"] as const) {
    for (const value of formData.getAll(key)) {
      if (value instanceof File && value.size > 0) files.push(value);
    }
  }
  return files.slice(0, SALES_KIT_MAX_FILES);
}

/** Parse an uploaded sales kit (PDF / DOCX / images) into listing drafts. */
export async function POST(request: Request) {
  const admin = await getCurrentOpsStaff();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Staff access required" },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const files = collectFiles(formData);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "NoFiles", message: "Upload at least one PDF, DOCX, or image." },
        { status: 400 },
      );
    }

    const prepared: Array<{ name: string; mimeType: string; data: Buffer }> =
      [];
    for (const file of files) {
      const mimeType = resolveSalesKitMime(file);
      if (!isAcceptedSalesKitMime(mimeType)) {
        return NextResponse.json(
          {
            error: "UnsupportedType",
            message: `${file.name}: use PDF, DOCX, JPEG, PNG, or WebP.`,
          },
          { status: 415 },
        );
      }
      if (file.size > SALES_KIT_MAX_BYTES) {
        return NextResponse.json(
          {
            error: "TooLarge",
            message: `${file.name} exceeds 4 MB. Compress or split the sales kit.`,
          },
          { status: 413 },
        );
      }
      prepared.push({
        name: file.name,
        mimeType,
        data: Buffer.from(await file.arrayBuffer()),
      });
    }

    const parsed = await parseSalesKitFiles(prepared);
    return NextResponse.json({
      data: parsed,
      fileNames: prepared.map((f) => f.name),
    });
  } catch (error) {
    const statusCode =
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 502;
    return NextResponse.json(
      {
        error: "ParseFailed",
        message:
          error instanceof Error
            ? error.message
            : "Sales kit could not be parsed.",
      },
      { status: statusCode },
    );
  }
}
