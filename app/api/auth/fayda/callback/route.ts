import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { completeFaydaOidcHandshake } from "@/lib/auth/fayda";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * GET|POST /api/auth/fayda/callback
 * Mock OpenID Connect callback handshake with Fayda eSignet.
 * Query/body: `code`, `state`, optional `userId` to bind the verified profile.
 */
async function handleCallback(request: NextRequest) {
  try {
    const url = new URL(request.url);
    let code = url.searchParams.get("code");
    let state = url.searchParams.get("state");
    let error = url.searchParams.get("error");
    let userId = url.searchParams.get("userId");

    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      code = (body.code as string | undefined) ?? code;
      state = (body.state as string | undefined) ?? state;
      error = (body.error as string | undefined) ?? error;
      userId = (body.userId as string | undefined) ?? userId;
    }

    const handshake = completeFaydaOidcHandshake({ code, state, error });
    const idTokenHash = createHash("sha256")
      .update(handshake.tokens.idToken)
      .digest("hex");

    const identity = await prisma.faydaIdentity.upsert({
      where: { subject: handshake.profile.subject },
      create: {
        subject: handshake.profile.subject,
        verifiedName: handshake.profile.verifiedName,
        profilePhotoUrl: handshake.profile.profilePhotoUrl,
        phoneE164: handshake.profile.phoneE164,
        idTokenHash,
        accessTokenExpiresAt: new Date(Date.now() + handshake.tokens.expiresIn * 1000),
        rawClaims: {
          mock: true,
          email: handshake.profile.email,
          provider: handshake.provider,
        },
        userId: userId || undefined,
      },
      update: {
        verifiedName: handshake.profile.verifiedName,
        profilePhotoUrl: handshake.profile.profilePhotoUrl,
        phoneE164: handshake.profile.phoneE164,
        idTokenHash,
        accessTokenExpiresAt: new Date(Date.now() + handshake.tokens.expiresIn * 1000),
        userId: userId || undefined,
      },
    });

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          fullName: handshake.profile.verifiedName,
          phone: handshake.profile.phoneE164,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      mock: true,
      provider: handshake.provider,
      identityId: identity.id,
      profile: {
        verifiedName: handshake.profile.verifiedName,
        profilePhotoUrl: handshake.profile.profilePhotoUrl,
        phoneE164: handshake.profile.phoneE164,
        subject: handshake.profile.subject,
      },
      tokens: {
        tokenType: handshake.tokens.tokenType,
        expiresIn: handshake.tokens.expiresIn,
        // Demo only — real deployments must not echo raw tokens to browsers.
        accessToken: handshake.tokens.accessToken,
        idToken: handshake.tokens.idToken,
      },
      session: handshake.session,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fayda eSignet callback failed";
    return NextResponse.json(
      { ok: false, error: "FaydaOidcError", message },
      { status: 400 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}
