"use client";

import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  lede: string;
  children?: ReactNode;
};

export function PageIntro({ eyebrow, title, lede, children }: PageIntroProps) {
  return (
    <div className="page-shell">
      <header className="page-shell__intro">
        <p className="home__eyebrow">{eyebrow}</p>
        <h1 className="home__title">{title}</h1>
        <p className="page-shell__lede">{lede}</p>
      </header>
      {children}
    </div>
  );
}
