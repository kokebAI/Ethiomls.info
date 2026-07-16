import type { ReactNode } from "react";
import { BrandMottoBanner } from "@/components/BrandMottoBanner";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  lede: string;
  motto?: string;
  children?: ReactNode;
};

export function PageIntro({
  eyebrow,
  title,
  lede,
  motto,
  children,
}: PageIntroProps) {
  return (
    <div className="flex flex-col gap-8">
      {motto ? <BrandMottoBanner motto={motto} className="animate-rise-in" /> : null}
      <header className="animate-rise-in max-w-3xl space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
          {eyebrow}
        </p>
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-slate-deep sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
          {lede}
        </p>
      </header>
      {children}
    </div>
  );
}
