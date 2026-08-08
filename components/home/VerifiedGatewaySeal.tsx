type VerifiedGatewaySealProps = {
  label: string;
  className?: string;
};

/** Large Option B gold “Verified Gateway” seal — hero identity mark. */
export function VerifiedGatewaySeal({
  label,
  className = "",
}: VerifiedGatewaySealProps) {
  const id = "vg-seal";
  return (
    <div
      className={`shrink-0 ${className}`.trim()}
      role="img"
      aria-label={label}
    >
      <svg
        className="block h-36 w-36 sm:h-44 sm:w-44 lg:h-56 lg:w-56"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${id}-ring`} x1="20" y1="20" x2="180" y2="180">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="45%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill="#0F172A" />
        <circle
          cx="100"
          cy="100"
          r="88"
          stroke={`url(#${id}-ring)`}
          strokeWidth="10"
          fill="#1E293B"
        />
        <circle
          cx="100"
          cy="100"
          r="72"
          stroke="#D97706"
          strokeWidth="2"
          strokeOpacity="0.55"
          fill="none"
        />
        <path
          d="M100 54c-18 10-30 20-36 34v34c0 22 14 40 36 48 22-8 36-26 36-48V88c-6-14-18-24-36-34Z"
          fill="#D97706"
        />
        <path
          d="M78 118V98.5L100 82l22 16.5V118h-8.5V103.5L100 91.5 86.5 103.5V118H78Z"
          fill="#F8FAFC"
        />
        <path d="M96 118v-14h8v14h-8Z" fill="#0F172A" />
      </svg>
    </div>
  );
}
