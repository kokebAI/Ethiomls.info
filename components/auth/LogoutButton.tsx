"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

export function LogoutButton() {
  const { locale, t } = useTranslation();
  const router = useRouter();

  return (
    <button
      type="button"
      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push(`/${locale}/login`);
        router.refresh();
      }}
    >
      {t("auth.logout")}
    </button>
  );
}
