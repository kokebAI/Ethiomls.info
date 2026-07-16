type AddisSkylineBackdropProps = {
  /** Light pages use a subtle wash; dark pages (login) show more contrast. */
  variant?: "light" | "dark";
  className?: string;
};

/**
 * Stylized Addis Ababa skyline — Entoto ridge, Bole high-rises, NIB tower silhouette.
 * Sits fixed at the viewport bottom behind page content.
 */
export function AddisSkylineBackdrop({
  variant = "light",
  className = "",
}: AddisSkylineBackdropProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={`pointer-events-none overflow-hidden ${
        isDark ? "absolute inset-0" : "fixed inset-x-0 bottom-0 z-0 h-[min(50vh,440px)]"
      } ${className}`}
      aria-hidden="true"
    >
      <div
        className={`absolute inset-x-0 bottom-0 ${
          isDark ? "h-[55%] opacity-90" : "h-full opacity-[0.44]"
        }`}
      >
        <svg
          viewBox="0 0 1440 360"
          preserveAspectRatio="xMidYMax slice"
          className="h-full w-full"
          role="img"
          aria-label="Addis Ababa skyline"
        >
          <defs>
            <linearGradient id="addis-sky" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isDark ? "#1e293b" : "#e2e8f0"} stopOpacity="0" />
              <stop offset="35%" stopColor={isDark ? "#334155" : "#cbd5e1"} stopOpacity="0.35" />
              <stop offset="100%" stopColor={isDark ? "#0f172a" : "#94a3b8"} stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="addis-hill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="addis-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Sky wash */}
          <rect width="1440" height="360" fill="url(#addis-sky)" />

          {/* Entoto ridge */}
          <path
            d="M0 220 C120 180, 200 195, 320 165 C440 135, 520 175, 640 150 C760 125, 880 160, 1000 140 C1120 120, 1240 155, 1360 130 L1440 145 L1440 360 L0 360 Z"
            fill="url(#addis-hill)"
          />

          {/* Mid-rise fabric */}
          <g fill={isDark ? "#1e293b" : "#cbd5e1"}>
            <rect x="40" y="248" width="52" height="112" rx="2" />
            <rect x="98" y="262" width="38" height="98" rx="2" />
            <rect x="142" y="255" width="44" height="105" rx="2" />
            <rect x="192" y="270" width="36" height="90" rx="2" />
            <rect x="234" y="258" width="48" height="102" rx="2" />
            <rect x="288" y="275" width="34" height="85" rx="2" />
            <rect x="1080" y="252" width="46" height="108" rx="2" />
            <rect x="1132" y="268" width="40" height="92" rx="2" />
            <rect x="1178" y="256" width="50" height="104" rx="2" />
            <rect x="1234" y="272" width="38" height="88" rx="2" />
            <rect x="1278" y="260" width="44" height="100" rx="2" />
            <rect x="1328" y="278" width="36" height="82" rx="2" />
            <rect x="1370" y="264" width="42" height="96" rx="2" />
          </g>

          {/* Bole cluster */}
          <g fill={isDark ? "#334155" : "#94a3b8"}>
            <rect x="520" y="210" width="58" height="150" rx="2" />
            <rect x="584" y="228" width="46" height="132" rx="2" />
            <rect x="636" y="218" width="52" height="142" rx="2" />
            <rect x="694" y="235" width="40" height="125" rx="2" />
            <rect x="740" y="205" width="62" height="155" rx="2" />
            <rect x="808" y="222" width="48" height="138" rx="2" />
            <rect x="862" y="212" width="54" height="148" rx="2" />
          </g>

          {/* NIB-style landmark tower */}
          <g fill={isDark ? "#475569" : "#64748b"}>
            <rect x="920" y="118" width="72" height="242" rx="3" />
            <rect x="934" y="98" width="44" height="28" rx="2" />
            <rect x="948" y="82" width="16" height="22" rx="1" />
          </g>

          {/* Gold window bands — imperial accent */}
          <g fill="url(#addis-gold)">
            <rect x="528" y="230" width="44" height="6" rx="1" />
            <rect x="528" y="248" width="44" height="6" rx="1" />
            <rect x="528" y="266" width="44" height="6" rx="1" />
            <rect x="748" y="225" width="48" height="6" rx="1" />
            <rect x="748" y="245" width="48" height="6" rx="1" />
            <rect x="748" y="265" width="48" height="6" rx="1" />
            <rect x="928" y="140" width="56" height="7" rx="1" />
            <rect x="928" y="168" width="56" height="7" rx="1" />
            <rect x="928" y="196" width="56" height="7" rx="1" />
            <rect x="928" y="224" width="56" height="7" rx="1" />
            <rect x="928" y="252" width="56" height="7" rx="1" />
            <rect x="928" y="280" width="56" height="7" rx="1" />
          </g>

          {/* Kirkos / central mid-rise */}
          <g fill={isDark ? "#1e293b" : "#b8c5d3"}>
            <rect x="380" y="238" width="56" height="122" rx="2" />
            <rect x="442" y="248" width="42" height="112" rx="2" />
            <rect x="490" y="242" width="48" height="118" rx="2" />
            <rect x="1000" y="240" width="50" height="120" rx="2" />
            <rect x="1056" y="250" width="42" height="110" rx="2" />
          </g>

          {/* Ground plane */}
          <rect
            x="0"
            y="348"
            width="1440"
            height="12"
            fill={isDark ? "#0f172a" : "#e2e8f0"}
            opacity="0.6"
          />
        </svg>
      </div>

      {/* Fade into page background */}
      <div
        className={`absolute inset-0 ${
          isDark
            ? "bg-gradient-to-b from-[#0f172a]/20 via-[#0f172a]/55 to-[#0f172a]/85"
            : "bg-gradient-to-b from-slate-50/10 via-slate-50/55 to-slate-50/95"
        }`}
      />
    </div>
  );
}
