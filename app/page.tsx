import { redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n/config";

/**
 * Root `/` has no localized UI. Prefer proxy.ts (Accept-Language + cookie),
 * but keep this page so Vercel/Next still resolve `/` if the proxy is skipped.
 */
export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
