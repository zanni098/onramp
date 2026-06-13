import React from 'react';

// Custom vector empty-state illustrations — geometric tile language matching
// the brand mark (squares + one green accent), drawn inline so they inherit
// the theme with zero asset requests.

type Variant = 'products' | 'transactions' | 'chart' | 'generic';

const STROKE = '#2E2E2E';
const GREEN = '#00C76F';

const Art = ({ variant }: { variant: Variant }) => {
  switch (variant) {
    case 'products':
      // A checkout link tag materializing from tiles.
      return (
        <svg width="160" height="100" viewBox="0 0 160 100" fill="none" aria-hidden="true">
          <rect x="14" y="22" width="56" height="56" rx="10" stroke={STROKE} strokeWidth="2" strokeDasharray="6 6" />
          <rect x="40" y="34" width="84" height="32" rx="8" fill="#161616" stroke={STROKE} strokeWidth="2" />
          <circle cx="56" cy="50" r="5" stroke={GREEN} strokeWidth="2.5" />
          <rect x="70" y="44" width="40" height="4.5" rx="2.25" fill="#3A3A3A" />
          <rect x="70" y="53" width="26" height="4.5" rx="2.25" fill="#2A2A2A" />
          <path d="M128 50 h14 m0 0 -5 -5 m5 5 -5 5" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'transactions':
      // Ledger rows waiting for their first settlement.
      return (
        <svg width="160" height="100" viewBox="0 0 160 100" fill="none" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <g key={i} opacity={1 - i * 0.3}>
              <rect x="22" y={22 + i * 22} width="116" height="14" rx="7" fill="#141414" stroke={STROKE} strokeWidth="1.5" />
              <circle cx="34" cy={29 + i * 22} r="3.5" fill={i === 0 ? GREEN : '#333'} />
              <rect x="46" y={26 + i * 22} width="34" height="5" rx="2.5" fill="#2E2E2E" />
              <rect x="104" y={26 + i * 22} width="22" height="5" rx="2.5" fill="#262626" />
            </g>
          ))}
        </svg>
      );
    case 'chart':
      // A ramp-shaped sparkline waiting for data.
      return (
        <svg width="160" height="100" viewBox="0 0 160 100" fill="none" aria-hidden="true">
          <path d="M20 80 H140" stroke={STROKE} strokeWidth="1.5" strokeDasharray="4 5" />
          <path d="M20 56 H140" stroke="#1C1C1C" strokeWidth="1.5" strokeDasharray="4 5" />
          <path d="M20 32 H140" stroke="#1C1C1C" strokeWidth="1.5" strokeDasharray="4 5" />
          <path d="M24 76 L60 62 L92 68 L136 30" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 7" opacity="0.8" />
          <circle cx="136" cy="30" r="4" fill="#0B0B0B" stroke={GREEN} strokeWidth="2.5" />
        </svg>
      );
    default:
      return (
        <svg width="160" height="100" viewBox="0 0 160 100" fill="none" aria-hidden="true">
          <rect x="52" y="22" width="24" height="24" rx="6" stroke={STROKE} strokeWidth="2" />
          <rect x="84" y="22" width="24" height="24" rx="6" fill={GREEN} opacity="0.9" />
          <rect x="52" y="54" width="24" height="24" rx="6" stroke={STROKE} strokeWidth="2" />
          <rect x="84" y="54" width="24" height="24" rx="6" stroke={STROKE} strokeWidth="2" />
        </svg>
      );
  }
};

const EmptyState = ({
  variant = 'generic',
  title,
  body,
  action,
}: {
  variant?: Variant;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6">
    <Art variant={variant} />
    <h4 className="text-white font-semibold text-[15px] mt-4">{title}</h4>
    {body && <p className="text-sub text-[13px] mt-1.5 max-w-xs leading-relaxed">{body}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
