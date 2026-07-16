import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";

/** Dashboard metrics live on the homepage — keep this route as a redirect. */
export default async function DashboardRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "en";
  redirect(`/${locale}#dashboard`);
}
