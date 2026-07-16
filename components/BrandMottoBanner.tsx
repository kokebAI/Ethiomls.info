type BrandMottoBannerProps = {
  motto: string;
  className?: string;
};

export function BrandMottoBanner({ motto, className = "" }: BrandMottoBannerProps) {
  return (
    <aside
      className={`relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0F172A_0%,#1E293B_55%,#0F172A_100%)] px-5 py-6 shadow-[var(--shadow-card)] sm:px-8 sm:py-7 ${className}`}
      aria-label={motto}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 20%, #D97706 0%, transparent 42%), radial-gradient(circle at 88% 80%, #D97706 0%, transparent 36%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D97706]/80 to-transparent"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <span
          className="hidden h-10 w-px shrink-0 bg-[#D97706]/70 sm:block"
          aria-hidden="true"
        />
        <p className="font-ethiopic text-balance text-xl font-semibold leading-snug tracking-tight text-slate-50 sm:text-2xl lg:text-[1.65rem]">
          <span className="text-[#D97706]" aria-hidden="true">
            “
          </span>
          {motto}
          <span className="text-[#D97706]" aria-hidden="true">
            ”
          </span>
        </p>
      </div>
    </aside>
  );
}
