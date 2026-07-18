import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { completeFaydaOidcHandshake } from "@/lib/auth/fayda";
import { prisma } from "@/lib/db/prisma";
import { isLiveFaydaConfigured } from "@/lib/properties/evidence";

export const runtime = "nodejs";

/**
 * POST /api/auth/fayda/verify
 * Binds Fayda identity to the signed-in user.
 * Live RP: returns authorize URL when FAYDA_CLIENT_ID is set.
 * Demo: completes mock eSignet handshake and upserts FaydaIdentity.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sign in required" },
      { status: 401 },
    );
  }

  if (isLiveFaydaConfigured()) {
    const authorize =
      process.env.FAYDA_AUTHORIZE_URL?.trim() ||
      "https://esignet.fayda.et/authorize";
    const clientId = process.env.FAYDA_CLIENT_ID!.trim();
    const redirectUri =
      process.env.FAYDA_REDIRECT_URI?.trim() ||
      `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ethiomls.info"}/api/auth/fayda/callback`;
    const state = randomBytes(16).toString("hex");
    const url = new URL(authorize);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "openid profile email");
    url.searchParams.set("state", state);
    url.searchParams.set("acr_values", "mosip:idp:acr:generated-code");
    return NextResponse.json({
      ok: true,
      live: true,
      authorizeUrl: url.toString(),
      message: "Complete Fayda eSignet OTP on the national ID portal.",
    });
  }

  let body: { code?: string } = {};
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    body = {};
  }

  const code = body.code?.trim() || `demo-${session.userId.slice(0, 8)}`;
  const handshake = completeFaydaOidcHandshake({ code, state: "demo" });
  const idTokenHash = createHash("sha256")
    .update(handshake.tokens.idToken)
    .digest("hex");

  // Prefer phone from session so demo Fayda matches the signed-in account.
  const phoneE164 =
    session.phone && /^\+251[79]\d{8}$/.test(session.phone)
      ? session.phone
      : handshake.profile.phoneE164;

  const identity = await prisma.faydaIdentity.upsert({
    where: { subject: handshake.profile.subject },
    create: {
      subject: handshake.profile.subject,
      verifiedName: handshake.profile.verifiedName,
      profilePhotoUrl: handshake.profile.profilePhotoUrl,
      phoneE164,
      idTokenHash,
      accessTokenExpiresAt: new Date(
        Date.now() + handshake.tokens.expiresIn * 1000,
      ),
      rawClaims: {
        mock: true,
        demo: true,
        provider: handshake.provider,
      },
      userId: session.userId,
    },
    update: {
      verifiedName: handshake.profile.verifiedName,
      profilePhotoUrl: handshake.profile.profilePhotoUrl,
      phoneE164,
      idTokenHash,
      accessTokenExpiresAt: new Date(
        Date.now() + handshake.tokens.expiresIn * 1000,
      ),
      userId: session.userId,
    },
  });

  return NextResponse.json({
    ok: true,
    live: false,
    mock: true,
    identityId: identity.id,
    profile: {
      verifiedName: identity.verifiedName,
      phoneE164: identity.phoneE164,
      subject: identity.subject,
    },
    message:
      "Demo Fayda verification complete. Real SMS OTP activates after Fayda RP credentials are configured at id.gov.et/api.",
  });
}
