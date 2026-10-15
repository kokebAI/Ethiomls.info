import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Page not found · EthioMLS",
  robots: { index: false, follow: false },
};

export default function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-start justify-center gap-4 px-6 py-16">
      <BrandMark title="EthioMLS" />
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-deep">
        Page not found
      </h1>
      <p className="text-pretty text-sm leading-relaxed text-ink-muted">
        That address is not on mls.et. Go back to the home page or browse
        listings.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/am"
          className="rounded-xl bg-slate-deep px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to home
        </Link>
        <Link
          href="/am/listings"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-deep"
        >
          Browse listings
        </Link>
      </div>
    </main>
  );
}
