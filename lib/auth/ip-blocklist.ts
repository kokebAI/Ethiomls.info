import { prisma } from "@/lib/db/prisma";

const DEFAULT_BAN_MS = 24 * 60 * 60 * 1000;

export async function isIpBlocked(ip: string): Promise<{
  blocked: boolean;
  retryAfterSec?: number;
  reason?: string;
}> {
  if (!ip || ip === "unknown") return { blocked: false };

  const row = await prisma.ipBlock.findUnique({ where: { ip } });
  if (!row) return { blocked: false };

  const now = Date.now();
  if (row.blockedUntil.getTime() <= now) {
    await prisma.ipBlock.delete({ where: { ip } }).catch(() => {});
    return { blocked: false };
  }

  return {
    blocked: true,
    reason: row.reason,
    retryAfterSec: Math.max(
      1,
      Math.ceil((row.blockedUntil.getTime() - now) / 1000),
    ),
  };
}

export async function banIp(input: {
  ip: string;
  reason: string;
  durationMs?: number;
}): Promise<void> {
  if (!input.ip || input.ip === "unknown") return;
  const durationMs = input.durationMs ?? DEFAULT_BAN_MS;
  const blockedUntil = new Date(Date.now() + durationMs);

  await prisma.ipBlock.upsert({
    where: { ip: input.ip },
    create: {
      ip: input.ip,
      reason: input.reason.slice(0, 500),
      blockedUntil,
      strikeCount: 1,
    },
    update: {
      reason: input.reason.slice(0, 500),
      blockedUntil,
      strikeCount: { increment: 1 },
    },
  });

  void syncVercelFirewallBlock(input.ip, input.reason).catch((error) => {
    console.warn("[ip-block] Vercel firewall sync skipped:", error);
  });
}

async function syncVercelFirewallBlock(ip: string, reason: string) {
  if (process.env.VERCEL_FIREWALL_AUTOBLOCK !== "true") return;
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token || !projectId) return;

  const url = new URL(
    "https://api.vercel.com/v1/security/firewall/ip-blocking",
  );
  url.searchParams.set("projectId", projectId);
  if (teamId) url.searchParams.set("teamId", teamId);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ip,
      action: "deny",
      hostname: "ethiomls.info",
      notes: reason.slice(0, 200),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Firewall API ${response.status}: ${text.slice(0, 200)}`);
  }
}
