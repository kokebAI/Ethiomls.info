import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";
import { renewPublishedListing } from "@/lib/listings/renew";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Refresh listing · EthioMLS",
  robots: { index: false, follow: false },
};

export default async function RenewListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { locale: raw, id: rawId } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const id = decodeURIComponent(rawId);
  const query = await searchParams;
  const copy = getDictionary(locale).renew;
  const listingHref = `/${locale}/listings/${encodeURIComponent(id)}`;

  const session = await getSession();
  if (!session) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/listings/${encodeURIComponent(id)}/renew`)}`,
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!listing) notFound();

  const title = pickLocalized(listing.title, locale) || listing.id;

  async function confirmRenew() {
    "use server";
    const result = await renewPublishedListing(id);
    const base = `/${locale}/listings/${encodeURIComponent(id)}/renew`;
    if (!result.ok) {
      if (result.code === "unauthorized") {
        redirect(`/${locale}/login?next=${encodeURIComponent(base)}`);
      }
      if (result.code === "not_found") notFound();
      redirect(`${base}?error=${result.code}`);
    }
    redirect(`${base}?done=1`);
  }

  const error =
    query.error === "forbidden"
      ? copy.forbidden
      : query.error === "not_live"
        ? copy.notLive
        : null;

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-deep">
        {query.done === "1" ? copy.doneTitle : copy.title}
      </h1>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-pretty text-sm leading-relaxed text-ink-muted">
        {query.done === "1" ? copy.doneBody : copy.lede}
      </p>
      {error ? (
        <p
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-2">
        {query.done === "1" ? (
          <Link
            href={listingHref}
            className="rounded-xl bg-slate-deep px-4 py-2.5 text-sm font-semibold text-white"
          >
            {copy.viewListing}
          </Link>
        ) : (
          <form action={confirmRenew}>
            <button
              type="submit"
              className="rounded-xl bg-slate-deep px-4 py-2.5 text-sm font-semibold text-white"
            >
              {copy.confirm}
            </button>
          </form>
        )}
        <Link
          href={listingHref}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-deep"
        >
          {copy.back}
        </Link>
      </div>
    </section>
  );
}
