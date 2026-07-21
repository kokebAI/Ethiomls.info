import { createSign } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import IORedis from "ioredis";
import { googleOAuthConfigured } from "@/lib/auth/oauth";
import {
  createGeminiClient,
  GEMINI_MODEL_CANDIDATES,
  isGeminiConfigured,
} from "@/lib/ai/gemini";
import { getLiveNbeUsdEtbRate } from "@/lib/compliance/nbeRate";
import { prisma } from "@/lib/db/prisma";
import { getDeployVersion } from "@/lib/ops/deploy-version";

export type IntegrationState = "ok" | "warn" | "error" | "unconfigured";

export type IntegrationStatus = {
  id: string;
  label: string;
  state: IntegrationState;
  detail: string;
};

const PROBE_TIMEOUT_MS = 2_000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms = PROBE_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timeout after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function smsProviderStatus(): IntegrationStatus {
  const configured = (process.env.SMS_PROVIDER ?? "mock").toLowerCase();
  const requested =
    configured === "hahu" ||
    configured === "afromessage" ||
    configured === "smsethiopia"
      ? configured
      : "mock";

  const hasCreds = (() => {
    if (requested === "hahu") {
      return Boolean(
        (process.env.HAHU_API_SECRET ?? process.env.HAHU_API_KEY)?.trim() &&
          process.env.HAHU_DEVICE_ID?.trim(),
      );
    }
    if (requested === "afromessage") {
      return Boolean(process.env.AFROMESSAGE_API_KEY?.trim());
    }
    if (requested === "smsethiopia") {
      return Boolean(process.env.SMSETHIOPIA_API_KEY?.trim());
    }
    return true;
  })();

  if (requested === "mock") {
    return {
      id: "sms",
      label: "SMS",
      state: "warn",
      detail: "mock mode",
    };
  }
  if (!hasCreds) {
    return {
      id: "sms",
      label: "SMS",
      state: "warn",
      detail: `${requested} · missing keys`,
    };
  }
  return {
    id: "sms",
    label: "SMS",
    state: "ok",
    detail: requested,
  };
}

async function probeDatabase(): Promise<IntegrationStatus> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      id: "database",
      label: "Database",
      state: "unconfigured",
      detail: "DATABASE_URL missing",
    };
  }
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`);
    return {
      id: "database",
      label: "Database",
      state: "ok",
      detail: "connected",
    };
  } catch (error) {
    return {
      id: "database",
      label: "Database",
      state: "error",
      detail: error instanceof Error ? error.message.slice(0, 80) : "unreachable",
    };
  }
}

async function probeSupabaseStorage(): Promise<IntegrationStatus> {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return {
      id: "supabase_storage",
      label: "Supabase Storage",
      state: "unconfigured",
      detail: "not linked",
    };
  }
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await withTimeout(
      client.storage.listBuckets().then((res) => res),
    );
    if (error) {
      return {
        id: "supabase_storage",
        label: "Supabase Storage",
        state: "error",
        detail: error.message.slice(0, 80),
      };
    }
    return {
      id: "supabase_storage",
      label: "Supabase Storage",
      state: "ok",
      detail: "reachable",
    };
  } catch (error) {
    return {
      id: "supabase_storage",
      label: "Supabase Storage",
      state: "error",
      detail: error instanceof Error ? error.message.slice(0, 80) : "unreachable",
    };
  }
}

async function probeRedis(): Promise<IntegrationStatus> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    return {
      id: "redis",
      label: "Redis",
      state: "unconfigured",
      detail: "REDIS_URL missing",
    };
  }
  const redis = new IORedis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: PROBE_TIMEOUT_MS,
    lazyConnect: true,
  });
  try {
    await withTimeout(
      (async () => {
        await redis.connect();
        const pong = await redis.ping();
        if (pong !== "PONG") throw new Error("unexpected ping reply");
      })(),
    );
    return {
      id: "redis",
      label: "Redis",
      state: "ok",
      detail: "pong",
    };
  } catch (error) {
    return {
      id: "redis",
      label: "Redis",
      state: "error",
      detail: error instanceof Error ? error.message.slice(0, 80) : "unreachable",
    };
  } finally {
    try {
      redis.disconnect();
    } catch {
      // ignore close errors
    }
  }
}

function probeGoogleOAuth(): IntegrationStatus {
  if (!googleOAuthConfigured()) {
    return {
      id: "google_oauth",
      label: "Google OAuth",
      state: "unconfigured",
      detail: "client id/secret missing",
    };
  }
  return {
    id: "google_oauth",
    label: "Google OAuth",
    state: "ok",
    detail: "configured",
  };
}

async function probeGemini(): Promise<IntegrationStatus> {
  if (!isGeminiConfigured()) {
    return {
      id: "google_gemini",
      label: "Google Gemini",
      state: "unconfigured",
      detail: "API key missing",
    };
  }
  try {
    const client = createGeminiClient();
    const modelId = GEMINI_MODEL_CANDIDATES[0] ?? "gemini-3.5-flash";
    await withTimeout(client.models.get({ model: modelId }));
    return {
      id: "google_gemini",
      label: "Google Gemini",
      state: "ok",
      detail: modelId,
    };
  } catch (error) {
    return {
      id: "google_gemini",
      label: "Google Gemini",
      state: "error",
      detail: error instanceof Error ? error.message.slice(0, 80) : "unreachable",
    };
  }
}

async function probeTelegram(): Promise<IntegrationStatus> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const channel = process.env.TELEGRAM_CHANNEL?.trim() || "@EthioMLS_Official";
  if (!token) {
    return {
      id: "telegram",
      label: "Telegram",
      state: "unconfigured",
      detail: "mock · no bot token",
    };
  }
  try {
    const res = await withTimeout(
      fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      }),
    );
    if (!res.ok) {
      return {
        id: "telegram",
        label: "Telegram",
        state: "error",
        detail: `HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as {
      ok?: boolean;
      result?: { username?: string };
    };
    if (!body.ok) {
      return {
        id: "telegram",
        label: "Telegram",
        state: "error",
        detail: "getMe failed",
      };
    }
    const bot = body.result?.username ? `@${body.result.username}` : "bot ok";
    return {
      id: "telegram",
      label: "Telegram",
      state: "ok",
      detail: `${bot} · ${channel}`,
    };
  } catch (error) {
    return {
      id: "telegram",
      label: "Telegram",
      state: "error",
      detail: error instanceof Error ? error.message.slice(0, 80) : "unreachable",
    };
  }
}

function probeFayda(): IntegrationStatus {
  if (!process.env.FAYDA_CLIENT_ID?.trim()) {
    return {
      id: "fayda",
      label: "Fayda",
      state: "warn",
      detail: "demo mode",
    };
  }
  return {
    id: "fayda",
    label: "Fayda",
    state: "ok",
    detail: "RP configured",
  };
}

function probeWebhookSecret(
  id: string,
  label: string,
  envName: string,
): IntegrationStatus {
  if (!process.env[envName]?.trim()) {
    return {
      id,
      label,
      state: "unconfigured",
      detail: "secret missing",
    };
  }
  return {
    id,
    label,
    state: "ok",
    detail: "webhook ready",
  };
}

async function probeNbeFx(): Promise<IntegrationStatus> {
  try {
    const rate = await withTimeout(getLiveNbeUsdEtbRate());
    return {
      id: "nbe_fx",
      label: "NBE FX",
      state: rate.source === "proxy" ? "warn" : "ok",
      detail: `${rate.usdEtb.toFixed(2)} ETB · ${rate.source}`,
    };
  } catch (error) {
    return {
      id: "nbe_fx",
      label: "NBE FX",
      state: "error",
      detail: error instanceof Error ? error.message.slice(0, 80) : "unreachable",
    };
  }
}

function probeDeploy(): IntegrationStatus {
  const version = getDeployVersion();
  return {
    id: "deploy",
    label: "Deploy",
    state: "ok",
    detail: `v${version.appVersion} · ${version.commitShort} · ${version.environment}`,
  };
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function parseWorkspaceServiceAccount(): ServiceAccountJson | null {
  const raw = process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function mintGoogleAccessToken(
  sa: ServiceAccountJson,
  scopes: string[],
  subject?: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim: Record<string, unknown> = {
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  if (subject) claim.sub = subject;
  const payload = base64url(JSON.stringify(claim));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(sa.private_key));
  const assertion = `${unsigned}.${signature}`;

  const res = await withTimeout(
    fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    }),
  );
  if (!res.ok) {
    throw new Error(`token HTTP ${res.status}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("no access_token");
  return body.access_token;
}

async function probeGoogleWorkspace(): Promise<IntegrationStatus> {
  const customerId = process.env.GOOGLE_WORKSPACE_CUSTOMER_ID?.trim();
  const sa = parseWorkspaceServiceAccount();
  const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL?.trim();

  if (!customerId || !sa) {
    return {
      id: "google_workspace",
      label: "Google Workspace",
      state: "unconfigured",
      detail: "not linked",
    };
  }

  try {
    const token = await mintGoogleAccessToken(
      sa,
      [
        "https://www.googleapis.com/auth/admin.directory.customer.readonly",
        "https://www.googleapis.com/auth/apps.licensing",
      ],
      adminEmail,
    );

    const customerRes = await withTimeout(
      fetch(
        `https://admin.googleapis.com/admin/directory/v1/customers/${encodeURIComponent(customerId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        },
      ),
    );

    if (!customerRes.ok) {
      return {
        id: "google_workspace",
        label: "Google Workspace",
        state: "error",
        detail: `customer HTTP ${customerRes.status}`,
      };
    }

    const customer = (await customerRes.json()) as {
      customerDomain?: string;
      postalAddress?: { organizationName?: string };
    };
    const org =
      customer.postalAddress?.organizationName ||
      customer.customerDomain ||
      customerId;

    let seatsDetail = "";
    try {
      const licRes = await withTimeout(
        fetch(
          `https://www.googleapis.com/apps/licensing/v1/customer/${encodeURIComponent(customerId)}/subscriptions`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          },
        ),
      );
      if (licRes.ok) {
        const lic = (await licRes.json()) as {
          items?: Array<{
            skuName?: string;
            seats?: { numberOfSeats?: number; licensedNumberOfSeats?: number };
          }>;
        };
        const first = lic.items?.[0];
        if (first) {
          const seats =
            first.seats?.licensedNumberOfSeats ??
            first.seats?.numberOfSeats;
          seatsDetail = first.skuName
            ? seats != null
              ? `${first.skuName} · ${seats} seats`
              : first.skuName
            : seats != null
              ? `${seats} seats`
              : "";
        }
      }
    } catch {
      // Subscription listing is optional — customer reachability is enough.
    }

    return {
      id: "google_workspace",
      label: "Google Workspace",
      state: "ok",
      detail: seatsDetail ? `${org} · ${seatsDetail}` : String(org),
    };
  } catch (error) {
    return {
      id: "google_workspace",
      label: "Google Workspace",
      state: "error",
      detail: error instanceof Error ? error.message.slice(0, 80) : "unreachable",
    };
  }
}

async function probeGithub(): Promise<IntegrationStatus> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const org = process.env.GITHUB_ORG?.trim();
  if (!token) {
    return {
      id: "github",
      label: "GitHub",
      state: "unconfigured",
      detail: "not linked",
    };
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "EthioMLS-AdminStatus",
  };

  try {
    if (org) {
      const res = await withTimeout(
        fetch(`https://api.github.com/orgs/${encodeURIComponent(org)}`, {
          headers,
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        }),
      );
      if (!res.ok) {
        return {
          id: "github",
          label: "GitHub",
          state: "error",
          detail: `org HTTP ${res.status}`,
        };
      }
      const body = (await res.json()) as {
        login?: string;
        plan?: { name?: string; seats?: number; filled_seats?: number };
      };
      const planName = body.plan?.name ?? "org";
      const seats =
        body.plan?.filled_seats != null && body.plan?.seats != null
          ? `${body.plan.filled_seats}/${body.plan.seats} seats`
          : body.plan?.seats != null
            ? `${body.plan.seats} seats`
            : null;
      return {
        id: "github",
        label: "GitHub",
        state: "ok",
        detail: seats
          ? `${body.login ?? org} · ${planName} · ${seats}`
          : `${body.login ?? org} · ${planName}`,
      };
    }

    const res = await withTimeout(
      fetch("https://api.github.com/user", {
        headers,
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      }),
    );
    if (!res.ok) {
      return {
        id: "github",
        label: "GitHub",
        state: "error",
        detail: `user HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as {
      login?: string;
      plan?: { name?: string };
    };
    const planName = body.plan?.name ?? "user";
    return {
      id: "github",
      label: "GitHub",
      state: "ok",
      detail: `${body.login ?? "user"} · ${planName}`,
    };
  } catch (error) {
    return {
      id: "github",
      label: "GitHub",
      state: "error",
      detail: error instanceof Error ? error.message.slice(0, 80) : "unreachable",
    };
  }
}

/**
 * Collect config + live health for every admin-visible integration.
 * Probes run in parallel with per-check timeouts; failures never throw.
 */
export async function collectIntegrationStatuses(): Promise<IntegrationStatus[]> {
  const results = await Promise.allSettled([
    probeDatabase(),
    probeSupabaseStorage(),
    probeRedis(),
    Promise.resolve(probeGoogleOAuth()),
    probeGemini(),
    probeGoogleWorkspace(),
    probeGithub(),
    Promise.resolve(smsProviderStatus()),
    probeTelegram(),
    Promise.resolve(probeFayda()),
    Promise.resolve(
      probeWebhookSecret("telebirr", "Telebirr", "TELEBIRR_WEBHOOK_SECRET"),
    ),
    Promise.resolve(
      probeWebhookSecret("cbe", "CBE Birr", "CBE_BIRR_WEBHOOK_SECRET"),
    ),
    probeNbeFx(),
    Promise.resolve(probeDeploy()),
  ]);

  return results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const fallbackIds = [
      "database",
      "supabase_storage",
      "redis",
      "google_oauth",
      "google_gemini",
      "google_workspace",
      "github",
      "sms",
      "telegram",
      "fayda",
      "telebirr",
      "cbe",
      "nbe_fx",
      "deploy",
    ] as const;
    const id = fallbackIds[index] ?? `unknown_${index}`;
    return {
      id,
      label: id,
      state: "error" as const,
      detail:
        result.reason instanceof Error
          ? result.reason.message.slice(0, 80)
          : "probe failed",
    };
  });
}
