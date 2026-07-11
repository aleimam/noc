// Tiny inline-SVG sparkline (no chart lib). No 'use client' — renders on the server in the
// district table and inside the client comparator alike.
import type { TrendPoint } from '../../lib/priceIndex';

export function Spark({ points, w = 96, h = 28 }: { points: TrendPoint[]; w?: number; h?: number }) {
  if (points.length < 2) return <span className="text-ink-300">—</span>;
  const vals = points.map((p) => p.avgPerM);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pad = 3;
  const xy = vals.map((v, i) => [
    pad + (i * (w - pad * 2)) / (vals.length - 1),
    h - pad - ((v - min) * (h - pad * 2)) / span,
  ] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1]!;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <polyline points={line} fill="none" stroke="#c9983e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="#c9983e" />
    </svg>
  );
}
