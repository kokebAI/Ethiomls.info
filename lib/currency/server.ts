import { cookies } from "next/headers";
import { getNbeUsdEtbDayRate } from "@/lib/compliance/nbeRate";
import { resolveNbeUsdEtbRate } from "@/lib/compliance/currency";
import {
  CURRENCY_COOKIE,
  parseDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/currency/preference";

export async function readDisplayCurrencyPreference(): Promise<{
  currency: DisplayCurrency;
  rateUsdEtb: number;
}> {
  const jar = await cookies();
  const currency = parseDisplayCurrency(jar.get(CURRENCY_COOKIE)?.value);
  try {
    const live = await getNbeUsdEtbDayRate();
    return { currency, rateUsdEtb: live.usdEtb };
  } catch {
    return { currency, rateUsdEtb: resolveNbeUsdEtbRate().usdEtb };
  }
}
