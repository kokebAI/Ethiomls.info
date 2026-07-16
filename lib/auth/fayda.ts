import { createHash, randomUUID } from "node:crypto";

export type FaydaVerifiedProfile = {
  subject: string;
  verifiedName: string;
  profilePhotoUrl: string;
  phoneE164: string;
  email?: string;
};

export type FaydaOidcCallbackResult = {
  mock: true;
  provider: "fayda-esignet";
  profile: FaydaVerifiedProfile;
  tokens: {
    idToken: string;
    accessToken: string;
    tokenType: "Bearer";
    expiresIn: number;
  };
  session: {
    state: string;
    nonce: string;
  };
};

const E164_ET_MOBILE = /^\+2519\d{8}$/;

/**
 * Mock eSignet userinfo claims — deterministic from authorization code for demos.
 */
export function mockEsignetUserInfo(code: string): FaydaVerifiedProfile {
  const digest = createHash("sha256").update(code || "anonymous").digest("hex");
  const nationalSuffix = digest.slice(0, 8).toUpperCase();
  const phoneTail = String(parseInt(digest.slice(8, 16), 16) % 100_000_000).padStart(
    8,
    "0",
  );

  return {
    subject: `fayda|ET|${nationalSuffix}`,
    verifiedName: `Verified Citizen ${nationalSuffix.slice(0, 4)}`,
    profilePhotoUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${nationalSuffix}`,
    phoneE164: `+2519${phoneTail}`,
    email: `citizen.${nationalSuffix.toLowerCase()}@fayda.local`,
  };
}

export function assertE164EthiopianMobile(phone: string): string {
  if (!E164_ET_MOBILE.test(phone)) {
    throw new Error(`Phone must be E.164 Ethiopian mobile (+2519XXXXXXXX): ${phone}`);
  }
  return phone;
}

/**
 * Mock OIDC authorization-code → tokens + verified Fayda profile handshake.
 */
export function completeFaydaOidcHandshake(input: {
  code?: string | null;
  state?: string | null;
  error?: string | null;
}): FaydaOidcCallbackResult {
  if (input.error) {
    throw new Error(`eSignet authorization error: ${input.error}`);
  }

  const code = input.code?.trim();
  if (!code) {
    throw new Error("Missing OIDC authorization code from Fayda eSignet callback");
  }

  const profile = mockEsignetUserInfo(code);
  assertE164EthiopianMobile(profile.phoneE164);

  const accessToken = `mock.access.${createHash("sha256").update(code).digest("base64url")}`;
  const idToken = Buffer.from(
    JSON.stringify({
      iss: "https://esignet.fayda.et/mock",
      sub: profile.subject,
      name: profile.verifiedName,
      picture: profile.profilePhotoUrl,
      phone_number: profile.phoneE164,
      phone_number_verified: true,
      aud: "ethiomls-web",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");

  return {
    mock: true,
    provider: "fayda-esignet",
    profile,
    tokens: {
      idToken: `eyJhbGciOiJub25lIn0.${idToken}.mock`,
      accessToken,
      tokenType: "Bearer",
      expiresIn: 3600,
    },
    session: {
      state: input.state?.trim() || randomUUID(),
      nonce: randomUUID(),
    },
  };
}
