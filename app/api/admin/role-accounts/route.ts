import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import {
  listRoleAccounts,
  resolveOrCreateRoleAccount,
} from "@/lib/imports/resolve-role-account";

export const runtime = "nodejs";

const createSchema = z.object({
  role: z.enum(["CORPORATE_DEVELOPER", "INDEPENDENT_DELALA"]),
  phone: z.string().trim().min(9).max(20),
  fullName: z.string().trim().min(2).max(120).optional(),
  tradeName: z.string().trim().min(2).max(160).optional(),
  registrationNumber: z.string().trim().min(3).max(80).optional(),
  website: z.string().trim().url().optional().nullable(),
});

/** List developer / broker accounts that scrapes can attach to. */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 },
    );
  }

  const data = await listRoleAccounts({ includeOwners: true });
  return NextResponse.json({ data });
}

/** Create (or resolve by phone) a developer/broker account for sales-kit ownership. */
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Provide role + Ethiopian phone for the account",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const result = await resolveOrCreateRoleAccount(parsed.data);
    return NextResponse.json(
      {
        data: result.account,
        created: result.created,
        message: result.created
          ? "Account created. They can sign in after resetting password via SMS (Reset password)."
          : "Existing account linked.",
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "RoleAccountError",
        message:
          error instanceof Error ? error.message : "Could not create account",
      },
      { status: 400 },
    );
  }
}
