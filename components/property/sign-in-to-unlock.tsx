import Link from "next/link";
import { Lock } from "lucide-react";

type SignInToUnlockProps = {
  message: string;
  ctaLabel: string;
  loginHref: string;
  /** Optional secondary link (e.g. existing account). */
  secondaryHref?: string;
  secondaryLabel?: string;
  className?: string;
  compact?: boolean;
};

/** Dashed locked panel prompting anonymous buyers to sign in. */
export function SignInToUnlock({
  message,
  ctaLabel,
  loginHref,
  secondaryHref,
  secondaryLabel,
  className = "",
  compact = false,
}: SignInToUnlockProps) {
  return (
    <div
      className={`rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center ${
        compact ? "px-3 py-5" : "px-4 py-8"
      } ${className}`.trim()}
    >
      <Lock
        className={`mx-auto text-slate-400 ${compact ? "h-4 w-4" : "h-5 w-5"}`}
        aria-hidden="true"
      />
      <p
        className={`mx-auto max-w-md text-slate-600 ${
          compact ? "mt-2 text-xs leading-relaxed" : "mt-3 text-sm leading-relaxed"
        }`}
      >
        {message}
      </p>
      <Link
        href={loginHref}
        className={`mt-3 inline-flex items-center justify-center rounded-full bg-brand-700 font-semibold text-white transition hover:bg-brand-800 ${
          compact ? "px-4 py-2 text-xs" : "px-5 py-2.5 text-sm"
        }`}
      >
        {ctaLabel}
      </Link>
      {secondaryHref && secondaryLabel ? (
        <Link
          href={secondaryHref}
          className="mt-2 block text-center text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
        >
          {secondaryLabel}
        </Link>
      ) : null}
    </div>
  );
}
