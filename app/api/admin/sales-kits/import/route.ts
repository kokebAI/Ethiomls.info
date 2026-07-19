import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { importSalesKitListings } from "@/lib/imports/sales-kit-import";
import { resolveOrCreateRoleAccount } from "@/lib/imports/resolve-role-account";

export const runtime = "nodejs";
export const maxDuration = 60;

const listingSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).default(""),
  price: z.number().finite().nonnegative().default(0),
  currency: z.enum(["ETB", "USD"]).default("ETB"),
  subCity: z.string().trim().min(2).max(40),
  addressLine: z.string().trim().max(300).optional().default(""),
  bedrooms: z.number().int().nonnegative().default(0),
  bathrooms: z.number().int().nonnegative().default(0),
  sizeM2: z.number().finite().nonnegative().default(0),
  floor: z.number().int().nullable().optional(),
  unitLabel: z.string().trim().max(40).nullable().optional(),
  listingType: z.enum(["SALE", "RENT", "OFF_PLAN"]).default("OFF_PLAN"),
  category: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "LAND"])
    .default("COMMERCIAL"),
  projectName: z.string().trim().max(200).nullable().optional(),
});

const bodySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  role: z.enum(["CORPORATE_DEVELOPER", "INDEPENDENT_DELALA"]).optional(),
  phone: z.string().trim().optional(),
  fullName: z.string().trim().optional(),
  tradeName: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  website: z.string().trim().optional().nullable(),
  sourceLabel: z.string().trim().max(160).default("sales-kit"),
  listings: z.array(listingSchema).min(1).max(40),
});

/** Commit parsed sales-kit listings onto a developer/broker role account. */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "InvalidJson", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Provide a role account and at least one listing draft",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    if (!parsed.data.userId && !parsed.data.phone) {
      throw new Error("Select an existing role account or provide a phone to create one");
    }
    if (!parsed.data.userId && !parsed.data.role) {
      throw new Error("Choose developer or broker when creating an account");
    }

    const { account, created } = await resolveOrCreateRoleAccount({
      userId: parsed.data.userId,
      role: parsed.data.role ?? "CORPORATE_DEVELOPER",
      phone: parsed.data.phone,
      fullName: parsed.data.fullName,
      tradeName: parsed.data.tradeName,
      registrationNumber: parsed.data.registrationNumber,
      website: parsed.data.website,
    });

    const result = await importSalesKitListings({
      account,
      listings: parsed.data.listings,
      sourceLabel: parsed.data.sourceLabel,
    });

    return NextResponse.json({
      data: {
        account,
        accountCreated: created,
        ...result,
      },
      message: created
        ? `Created account for ${account.label} and imported ${result.created} listings (pending review). They sign in via Reset password on ${account.phone ?? "their phone"}.`
        : `Imported ${result.created} listings for ${account.label} (pending review).`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "ImportFailed",
        message:
          error instanceof Error ? error.message : "Sales kit import failed",
      },
      { status: 400 },
    );
  }
}
