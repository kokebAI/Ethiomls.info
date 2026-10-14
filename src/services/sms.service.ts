import {
  renderSmsTemplate,
  resolveSmsLocale,
  type SmsLocale,
  type SmsTemplateId,
} from "@/src/services/sms.templates";

export type SmsProvider = "gateway" | "mock";

export type EthioMlsSmsPurpose =
  | "register_otp"
  | "reset_otp"
  | "login_otp"
  | "scrape_invite"
  | "listing_lifecycle"
  | "secure_route";

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
 * Unified SMS transport via shared Python push gateway (AfroMessage on host).
 */
export class SmsNotificationEngine {
  private readonly provider: SmsProvider;
  private readonly siteBase: string;

  constructor() {
    const configured = (process.env.SMS_PROVIDER ?? "gateway").toLowerCase();
    const requested: SmsProvider =
      configured === "gateway" || configured === "afromessage"
        ? "gateway"
        : configured === "mock"
          ? "mock"
          : "gateway";
    this.provider = SmsNotificationEngine.hasCredentials(requested)
      ? requested
      : "mock";
    if (this.provider !== requested && requested === "gateway") {
      console.warn(
        `[sms] SMS_PROVIDER=gateway is missing SMS_PUSH_URL/SMS_PUSH_APP_KEY — falling back to mock mode (OTP codes are echoed to the client).`,
      );
    }
    this.siteBase = (
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://ethiomls.info"
    ).replace(/\/$/, "");
  }

  private static hasCredentials(provider: SmsProvider): boolean {
    if (provider === "gateway") {
      return Boolean(
        (process.env.SMS_PUSH_URL ?? "http://127.0.0.1:8091").trim() &&
          process.env.SMS_PUSH_APP_KEY?.trim(),
      );
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
    purpose?: EthioMlsSmsPurpose;
  }): Promise<SmsSendResult> {
    const locale = input.locale ?? this.detectLocale(input.user);
    const body = this.render(input.templateId, locale, {
      url: input.url,
      kind: input.kind,
    });
    const purpose =
      input.purpose ??
      (String(input.templateId).includes("secure")
        ? "secure_route"
        : "listing_lifecycle");
    return this.sendRaw({ toE164: input.toE164, body, locale, purpose });
  }

  async sendRaw(input: {
    toE164: string;
    body: string;
    locale: SmsLocale;
    purpose: EthioMlsSmsPurpose;
    code?: string;
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
      if (this.provider === "gateway") {
        return await this.sendViaGateway(
          to,
          input.body,
          input.locale,
          input.purpose,
          input.code,
        );
      }

      console.info(
        `[sms:mock] → ${to} (${input.locale}/${input.purpose}): ${input.body}`,
      );
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
   * Shared Python SMS push on the host (AfroMessage).
   * POST {SMS_PUSH_URL}/v1/send
   */
  private async sendViaGateway(
    to: string,
    body: string,
    locale: SmsLocale,
    purpose: EthioMlsSmsPurpose,
    code?: string,
  ): Promise<SmsSendResult> {
    const base = (
      process.env.SMS_PUSH_URL ?? "http://127.0.0.1:8091"
    ).replace(/\/$/, "");
    const appKey = process.env.SMS_PUSH_APP_KEY?.trim();
    if (!appKey) throw new Error("SMS_PUSH_APP_KEY is not configured");

    const payload: Record<string, string> = {
      app: "ethiomls",
      purpose,
      phone: to,
      message: body,
    };
    if (code?.trim()) payload.code = code.trim();

    const response = await fetch(`${base}/v1/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      detail?: string;
      body?: { response?: { message_id?: string; id?: string } };
    };

    if (!response.ok || data.ok === false) {
      throw new Error(
        data.detail ?? data.error ?? `SMS push HTTP ${response.status}`,
      );
    }

    return {
      ok: true,
      provider: "gateway",
      messageId: data.body?.response?.message_id ?? data.body?.response?.id,
      to,
      body,
      locale,
    };
  }
}

export const smsNotificationEngine = new SmsNotificationEngine();
