// Onramp brand mark.
//
// Geometry: a 2×2 tile grid (quincunx-family, OKX-school geometric identity)
// where the top-right tile is the "on-ramp" — a green tile carrying an
// upward-right arrow. Three monochrome tiles ground it; the single accent
// tile is the brand's one allowed color.

const GREEN = '#00C76F';

export const LogoMark = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="0" y="0" width="10.5" height="10.5" rx="2.5" fill="currentColor" />
    <rect x="0" y="13.5" width="10.5" height="10.5" rx="2.5" fill="currentColor" />
    <rect x="13.5" y="13.5" width="10.5" height="10.5" rx="2.5" fill="currentColor" />
    <rect x="13.5" y="0" width="10.5" height="10.5" rx="2.5" fill={GREEN} />
    <path
      d="M16.6 7.4 L21 3 M21 3 H17.4 M21 3 V6.6"
      stroke="#000"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Logo = ({
  size = 22,
  text = true,
  className = '',
}: {
  size?: number;
  text?: boolean;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center gap-2 text-white select-none ${className}`}
  >
    <LogoMark size={size} />
    {text && (
      <span
        className="font-sans font-bold tracking-tight text-white"
        style={{ fontSize: Math.round(size * 0.85), letterSpacing: '-0.03em' }}
      >
        onramp
      </span>
    )}
  </span>
);

export default Logo;
