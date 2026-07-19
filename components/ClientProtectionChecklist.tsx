type ClientProtectionChecklistProps = {
  title: string;
  lede: string;
  items: string[];
  /** Optional heading id for aria-labelledby */
  headingId?: string;
};

/** Buyer-facing summary of the screens every published listing must pass. */
export function ClientProtectionChecklist({
  title,
  lede,
  items,
  headingId = "client-protection-checklist",
}: ClientProtectionChecklistProps) {
  return (
    <section
      className="rounded-2xl border border-slate-200/90 bg-slate-deep px-5 py-6 text-white shadow-[var(--shadow-card)] sm:px-7 sm:py-7"
      aria-labelledby={headingId}
    >
      <h2
        id={headingId}
        className="text-lg font-semibold tracking-tight sm:text-xl"
      >
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
        {lede}
      </p>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 text-sm text-slate-200"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
