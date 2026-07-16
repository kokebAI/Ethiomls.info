import {
  convertBudget,
  formatMoney,
  resolveNbeUsdEtbRate,
} from "@/lib/compliance/currency";

export type TelegramInlineButton = {
  text: string;
  url: string;
};

export type TelegramBroadcastCard = {
  text: string;
  photo?: Buffer;
  filename?: string;
  buttons: TelegramInlineButton[][];
};

/**
 * Lightweight Telegram Bot API wrapper for EthioMLS channel broadcasts.
 */
export class TelegramBotService {
  private readonly token: string;
  private readonly channel: string;
  private readonly apiBase: string;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN ?? "";
    this.channel = process.env.TELEGRAM_CHANNEL ?? "@EthioMLS_Official";
    this.apiBase = `https://api.telegram.org/bot${this.token}`;
  }

  get isConfigured(): boolean {
    return Boolean(this.token);
  }

  buildListingCard(input: {
    listingId: string;
    propertyType: string;
    subCity: string;
    priceAmount: number;
    priceCurrency: "ETB" | "USD";
    waterAvailable: boolean;
    powerBackup: boolean;
    titleEn?: string;
    titleAm?: string;
    photo?: Buffer | null;
    filename?: string;
  }): TelegramBroadcastCard {
    const rate = resolveNbeUsdEtbRate();
    const etb =
      input.priceCurrency === "ETB"
        ? input.priceAmount
        : convertBudget(input.priceAmount, "USD", "ETB", rate);
    const usd =
      input.priceCurrency === "USD"
        ? input.priceAmount
        : convertBudget(input.priceAmount, "ETB", "USD", rate);

    const site = (
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://ethiomls.info"
    ).replace(/\/$/, "");
    const listingUrl = `${site}/listing/${input.listingId}`;

    const waterEn = input.waterAvailable ? "Reliable" : "Limited";
    const powerEn = input.powerBackup ? "Backup available" : "No backup flagged";
    const waterAm = input.waterAvailable
      ? "\u12A0\u1235\u1270\u121B\u121B\u129D"
      : "\u12CD\u1235\u1295";
    const powerAm = input.powerBackup
      ? "\u1263\u12AD\u12A0\u1355 \u12A0\u1208"
      : "\u1263\u12AD\u12A0\u1355 \u12E8\u1208\u121D";

    const text = [
      "\u{1F3E0} <b>EthioMLS New Active Listing</b>",
      "",
      `<b>EN</b> ${input.titleEn ?? input.propertyType}`,
      `Type: ${input.propertyType}`,
      `Price: ${formatMoney(etb, "ETB")} · Diaspora ${formatMoney(usd, "USD")}`,
      `Sub-city: ${input.subCity}`,
      `Water: ${waterEn} · Power: ${powerEn}`,
      "",
      `<b>\u12A0\u121B</b> ${input.titleAm ?? input.propertyType}`,
      `\u12D3\u12ED\u1290\u1275\u1361 ${input.propertyType}`,
      `\u12CB\u130B\u1361 ${formatMoney(etb, "ETB")} · \u12F2\u12EB\u1235\u1356\u122B ${formatMoney(usd, "USD")}`,
      `\u12AD\u134D\u1208 \u12A8\u1270\u121B\u1361 ${input.subCity}`,
      `\u12CD\u1203\u1361 ${waterAm} · \u1203\u12ED\u120D\u1361 ${powerAm}`,
    ].join("\n");

    return {
      text,
      photo: input.photo ?? undefined,
      filename: input.filename,
      buttons: [
        [
          {
            text: `🌐 View 360° Walkthrough & Owner Contacts: ethiomls.info/listing/${input.listingId}`,
            url: listingUrl,
          },
        ],
      ],
    };
  }

  async publishCard(card: TelegramBroadcastCard): Promise<{
    ok: boolean;
    messageId?: number;
    mock?: boolean;
    error?: string;
  }> {
    if (!this.isConfigured) {
      console.info(
        `[telegram:mock] → ${this.channel}\n${card.text}\nbuttons=${JSON.stringify(card.buttons)}`,
      );
      return { ok: true, mock: true, messageId: Date.now() };
    }

    try {
      if (card.photo) {
        const form = new FormData();
        form.set("chat_id", this.channel);
        form.set("caption", card.text.slice(0, 1024));
        form.set("parse_mode", "HTML");
        form.set(
          "reply_markup",
          JSON.stringify({ inline_keyboard: card.buttons }),
        );
        form.set(
          "photo",
          new Blob([new Uint8Array(card.photo)], { type: "image/webp" }),
          card.filename ?? "listing.webp",
        );

        const response = await fetch(`${this.apiBase}/sendPhoto`, {
          method: "POST",
          body: form,
        });
        const data = (await response.json()) as {
          ok: boolean;
          result?: { message_id?: number };
          description?: string;
        };
        if (!data.ok) {
          return { ok: false, error: data.description ?? "sendPhoto failed" };
        }
        return { ok: true, messageId: data.result?.message_id };
      }

      const response = await fetch(`${this.apiBase}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.channel,
          text: card.text,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: card.buttons },
          disable_web_page_preview: false,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        result?: { message_id?: number };
        description?: string;
      };
      if (!data.ok) {
        return { ok: false, error: data.description ?? "sendMessage failed" };
      }
      return { ok: true, messageId: data.result?.message_id };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Telegram publish failed",
      };
    }
  }
}

export const telegramBotService = new TelegramBotService();
