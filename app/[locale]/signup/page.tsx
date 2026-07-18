import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";

/** Alias — signup happens on the login page's Register tab. */
export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "am";
  redirect(`/${locale}/login?mode=register`);
}
