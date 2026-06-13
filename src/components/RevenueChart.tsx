import { useMemo, useState } from 'react';

// Dependency-free SVG revenue area chart (last 30 days, confirmed txns).
// OKX-style: hairline grid, green line with soft gradient fill, crosshair
// tooltip on hover, tabular numerals.

interface Txn {
  created_at: string;
  amount_usd: number | null;
}

const W = 720;
const H = 200;
const PAD = { top: 14, right: 10, bottom: 26, left: 46 };
const DAYS = 30;
const GREEN = '#00C76F';

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const RevenueChart = ({ transactions }: { transactions: Txn[] }) => {
  const [hover, setHover] = useState<number | null>(null);

  const { points, max, labels } = useMemo(() => {
    const buckets = new Map<string, number>();
    const now = new Date();
    const keys: string[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const k = dayKey(d);
      keys.push(k);
      buckets.set(k, 0);
    }
    for (const t of transactions) {
      const k = t.created_at.slice(0, 10);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + (t.amount_usd ?? 0));
    }
    const vals = keys.map((k) => buckets.get(k) ?? 0);
    const mx = Math.max(...vals, 1);
    return {
      points: vals,
      max: mx,
      labels: keys.map((k) => k.slice(5).replace('-', '/')),
    };
  }, [transactions]);

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (DAYS - 1)) * iw;
  const y = (v: number) => PAD.top + ih - (v / max) * ih;

  const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(DAYS - 1).toFixed(1)},${PAD.top + ih} L${x(0).toFixed(1)},${PAD.top + ih} Z`;

  const gridLines = [0, 0.5, 1].map((f) => PAD.top + ih - f * ih);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD.left) / iw) * (DAYS - 1));
          setHover(Math.min(DAYS - 1, Math.max(0, i)));
        }}
      >
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.22" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((gy, i) => (
          <line key={i} x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} stroke="#1E1E1E" strokeWidth="1" strokeDasharray={i === 0 ? undefined : '3 5'} />
        ))}

        {/* y-axis labels */}
        <text x={PAD.left - 8} y={y(max) + 4} textAnchor="end" fontSize="10" fill="#5E6673" fontFamily="Inter, sans-serif">${max >= 1000 ? `${(max / 1000).toFixed(1)}k` : max.toFixed(0)}</text>
        <text x={PAD.left - 8} y={PAD.top + ih + 4} textAnchor="end" fontSize="10" fill="#5E6673" fontFamily="Inter, sans-serif">$0</text>
        {/* x-axis labels */}
        <text x={x(0)} y={H - 8} textAnchor="start" fontSize="10" fill="#5E6673" fontFamily="Inter, sans-serif">{labels[0]}</text>
        <text x={x(DAYS - 1)} y={H - 8} textAnchor="end" fontSize="10" fill="#5E6673" fontFamily="Inter, sans-serif">{labels[DAYS - 1]}</text>

        <path d={areaPath} fill="url(#rev-fill)" />
        <path d={linePath} fill="none" stroke={GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="#3A3A3A" strokeWidth="1" strokeDasharray="3 4" />
            <circle cx={x(hover)} cy={y(points[hover])} r="4" fill="#0B0B0B" stroke={GREEN} strokeWidth="2" />
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className="absolute -top-1 okx-tooltip"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > DAYS * 0.7 ? '-110%' : '10%'})`,
          }}
        >
          <span className="text-sub">{labels[hover]}</span>
          <span className="text-white font-semibold tabular-nums ml-2">
            ${points[hover].toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
};

export default RevenueChart;
