import {
  renderSmsTemplate,
  resolveSmsLocale,
  type SmsLocale,
  type SmsTemplateId,
} from "@/src/services/sms.templates";

export type SmsProvider = "hahu" | "afromessage" | "smsethiopia" | "mock";

export type SmsSendResult = {
  ok: boolean;
  provider: SmsProvider;
  messageId?: string;
  to: string;
  body: string;
  locale: SmsLocale;
  error?: string;
};

type SmsUserPrefs = {
  localePrefs?: unknown;
};

/**
 * Unified SMS transport (Hahu.io primary) with locale-aware templates.
 */
export class SmsNotificationEngine {
  private readonly provider: SmsProvider;
  private readonly from: string;
  private readonly siteBase: string;

  constructor() {
    const configured = (process.env.SMS_PROVIDER ?? "mock").toLowerCase();
    const requested: SmsProvider =
      configured === "hahu" ||
      configured === "afromessage" ||
      configured === "smsethiopia"
        ? configured
        : "mock";
    this.provider = SmsNotificationEngine.hasCredentials(requested)
      ? requested
      : "mock";
    if (this.provider !== requested) {
      console.warn(
        `[sms] SMS_PROVIDER="${requested}" is missing credentials — falling back to mock mode (OTP codes are echoed to the client).`,
      );
    }
    this.from = process.env.SMS_FROM ?? "EthioMLS";
    this.siteBase = (
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://ethiomls.info"
    ).replace(/\/$/, "");
  }

  /** A provider is usable only when its required env credentials are set. */
  private static hasCredentials(provider: SmsProvider): boolean {
    if (provider === "hahu") {
      return Boolean(
        (process.env.HAHU_API_SECRET ?? process.env.HAHU_API_KEY)?.trim() &&
          process.env.HAHU_DEVICE_ID?.trim(),
      );
    }
    if (provider === "afromessage") {
      return Boolean(process.env.AFROMESSAGE_API_KEY?.trim());
    }
    if (provider === "smsethiopia") {
      return Boolean(process.env.SMSETHIOPIA_API_KEY?.trim());
    }
    return true;
  }

  detectLocale(user: SmsUserPrefs | null | undefined): SmsLocale {
    return resolveSmsLocale(user?.localePrefs);
  }

  buildAbsoluteUrl(path: string): string {
    if (path.startsWith("http")) return path;
    return `${this.siteBase}${path.startsWith("/") ? path : `/${path}`}`;
  }

  render(
    templateId: SmsTemplateId,
    locale: SmsLocale,
    params: { url?: string; kind?: "mesob" | "escrow" } = {},
  ): string {
    return renderSmsTemplate(templateId, locale, {
      ...params,
      url: params.url ? this.buildAbsoluteUrl(params.url) : undefined,
    });
  }

  async sendTemplate(input: {
    toE164: string;
    templateId: SmsTemplateId;
    user?: SmsUserPrefs | null;
    locale?: SmsLocale;
    url?: string;
    kind?: "mesob" | "escrow";
  }): Promise<SmsSendResult> {
    const locale = input.locale ?? this.detectLocale(input.user);
    const body = this.render(input.templateId, locale, {
      url: input.url,
      kind: input.kind,
    });
    return this.sendRaw({ toE164: input.toE164, body, locale });
  }

  async sendRaw(input: {
    toE164: string;
    body: string;
    locale: SmsLocale;
  }): Promise<SmsSendResult> {
    const to = input.toE164.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(to)) {
      return {
        ok: false,
        provider: this.provider,
        to,
        body: input.body,
        locale: input.locale,
        error: "Invalid E.164 phone number",
      };
    }

    try {
      if (this.provider === "hahu") {
        return await this.sendViaHahu(to, input.body, input.locale);
      }
      if (this.provider === "afromessage") {
        return await this.sendViaAfroMessage(to, input.body, input.locale);
      }
      if (this.provider === "smsethiopia") {
        return await this.sendViaSmsEthiopia(to, input.body, input.locale);
      }

      console.info(`[sms:mock] → ${to} (${input.locale}): ${input.body}`);
      return {
        ok: true,
        provider: "mock",
        messageId: `mock_${Date.now()}`,
        to,
        body: input.body,
        locale: input.locale,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.provider,
        to,
        body: input.body,
        locale: input.locale,
        error: error instanceof Error ? error.message : "SMS send failed",
      };
    }
  }

  /**
   * Hahu.io Android SMS gateway — https://hahu.io/api/send/sms
   * Requires linked Android device (HAHU_DEVICE_ID) + API secret.
   */
  private async sendViaHahu(
    to: string,
    body: string,
    locale: SmsLocale,
  ): Promise<SmsSendResult> {
    const secret = process.env.HAHU_API_SECRET ?? process.env.HAHU_API_KEY;
    const device = process.env.HAHU_DEVICE_ID;
    const sim = process.env.HAHU_SIM ?? "1";
    const priority = process.env.HAHU_PRIORITY ?? "1";
    const endpoint =
      process.env.HAHU_API_URL ?? "https://hahu.io/api/send/sms";

    if (!secret) throw new Error("HAHU_API_SECRET is not configured");
    if (!device) throw new Error("HAHU_DEVICE_ID is not configured");

    const url = new URL(endpoint);
    // Prefer POST form body so newlines and long Unicode invites are preserved.
    // Cold-onboarding bilingual SMS is multipart; keep a high ceiling.
    const maxChars = Number(process.env.HAHU_SMS_MAX_CHARS ?? "4000");
    const safeMax =
      Number.isFinite(maxChars) && maxChars > 0
        ? Math.min(Math.trunc(maxChars), 6000)
        : 4000;
    const message = [...body].slice(0, safeMax).join("");
    const form = new URLSearchParams({
      secret,
      mode: "devices",
      device,
      sim,
      priority,
      phone: to,
      message,
    });

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = (await response.json().catch(() => ({}))) as {
      status?: number | string;
      message?: string;
      data?: { id?: string | number; messageId?: string };
      id?: string | number;
    };

    const statusOk =
      response.ok &&
      (data.status === undefined ||
        data.status === 200 ||
        data.status === "200" ||
        data.status === 1 ||
        data.status === "success");

    if (!statusOk) {
      throw new Error(
        data.message ?? `Hahu.io HTTP ${response.status}`,
      );
    }

    return {
      ok: true,
      provider: "hahu",
      messageId: String(
        data.data?.messageId ?? data.data?.id ?? data.id ?? "",
      ) || undefined,
      to,
      body,
      locale,
    };
  }

  private async sendViaAfroMessage(
    to: string,
    body: string,
    locale: SmsLocale,
  ): Promise<SmsSendResult> {
    const token = process.env.AFROMESSAGE_API_KEY;
    const sender = process.env.AFROMESSAGE_IDENTIFIER_ID ?? this.from;
    if (!token) throw new Error("AFROMESSAGE_API_KEY is not configured");

    const response = await fetch("https://api.afromessage.com/api/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        sender,
        to,
        message: body,
      }),
    });

    if (!response.ok) {
      throw new Error(`AfroMessage HTTP ${response.status}`);
    }

    const data = (await response.json().catch(() => ({}))) as {
      acknowledge?: string;
      response?: { message_id?: string; id?: string };
    };

    return {
      ok: true,
      provider: "afromessage",
      messageId: data.response?.message_id ?? data.response?.id,
      to,
      body,
      locale,
    };
  }

  private async sendViaSmsEthiopia(
    to: string,
    body: string,
    locale: SmsLocale,
  ): Promise<SmsSendResult> {
    const apiKey = process.env.SMSETHIOPIA_API_KEY;
    const endpoint =
      process.env.SMSETHIOPIA_API_URL ??
      "https://api.smsethiopia.et/v1/messages";
    if (!apiKey) throw new Error("SMSETHIOPIA_API_KEY is not configured");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to,
        text: body,
      }),
    });

    if (!response.ok) {
      throw new Error(`SMSEthiopia HTTP ${response.status}`);
    }

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      messageId?: string;
    };

    return {
      ok: true,
      provider: "smsethiopia",
      messageId: data.messageId ?? data.id,
      to,
      body,
      locale,
    };
  }
}

export const smsNotificationEngine = new SmsNotificationEngine();
