import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Reject private / loopback targets before fetching scrape sources. */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only public http(s) URLs can be scraped");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That host is not allowed");
  }

  const ipLiteral = isIP(host) ? host : null;
  if (ipLiteral && isPrivateIp(ipLiteral)) {
    throw new Error("Private IP addresses cannot be scraped");
  }

  if (!ipLiteral) {
    const records = await lookup(host, { all: true });
    if (!records.length) throw new Error("Hostname could not be resolved");
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        throw new Error("Hostname resolves to a private network");
      }
    }
  }

  return url;
}

export async function fetchPublicText(
  rawUrl: string,
  init?: RequestInit,
): Promise<{ url: string; html: string }> {
  const url = await assertPublicHttpUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url.toString(), {
      ...init,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "EthioMLSImportBot/1.0 (+https://ethiomls.info)",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Fetch failed with HTTP ${response.status}`);
    }
    const finalUrl = response.url || url.toString();
    await assertPublicHttpUrl(finalUrl);
    const html = await response.text();
    if (html.length > 2_000_000) {
      throw new Error("Response is too large to scrape");
    }
    return { url: finalUrl, html };
  } finally {
    clearTimeout(timeout);
  }
}
