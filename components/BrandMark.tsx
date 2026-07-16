type BrandMarkProps = {
  className?: string;
  title?: string;
};

/** Crisp geometric identity mark: foundation plinth + rising roof on deep slate. */
export function BrandMark({ className = "h-10 w-10", title }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <rect width="40" height="40" rx="10" fill="#0F172A" />
      <path
        d="M8 28.5h24v2.5H8V28.5Z"
        fill="#D97706"
      />
      <path
        d="M11 28.5V18.2L20 11l9 7.2v10.3h-3.2V19.6L20 14.4l-5.8 5.2v8.9H11Z"
        fill="#F8FAFC"
      />
      <path
        d="M18.6 28.5V22.8h2.8v5.7h-2.8Z"
        fill="#D97706"
      />
    </svg>
  );
}
