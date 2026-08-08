import type { ReactNode } from "react";
import { BrandMottoBanner } from "@/components/BrandMottoBanner";

type PageIntroProps = {
  /** @deprecated Kickers are banned — accepted for call-site compatibility but never rendered. */
  eyebrow?: string;
  title: string;
  lede: string;
  motto?: string;
  children?: ReactNode;
};

export function PageIntro({
  title,
  lede,
  motto,
  children,
}: PageIntroProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-8 sm:gap-10">
      <header className="animate-rise-in max-w-3xl space-y-3">
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-slate-deep sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-ink sm:text-base">
          {lede}
        </p>
      </header>
      {children}
      {motto ? (
        <BrandMottoBanner motto={motto} className="animate-rise-in" />
      ) : null}
    </div>
  );
}
