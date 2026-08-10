"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export interface BarSeries {
  name: string;
  color: string;
  values: number[];
}

interface MarketingBarsProps {
  labels: string[];
  series: BarSeries[];
  formatter?: (v: number) => string;
  emptyText?: string;
}

const W = 720;
const H = 240;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 32;

function niceMax(n: number): number {
  if (n <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / mag;
  if (f <= 1) return mag;
  if (f <= 2) return 2 * mag;
  if (f <= 5) return 5 * mag;
  return 10 * mag;
}

/** Gráfico de barras agrupadas (SVG) com hover — padrão visual do painel. */
export function MarketingBars({ labels, series, formatter, emptyText }: MarketingBarsProps) {
  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(
    () => Math.max(0, ...series.flatMap((s) => s.values), 0),
    [series],
  );
  const yMax = niceMax(max * 1.15);
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const groupW = labels.length > 1 ? innerW / labels.length : innerW;
  const barW = Math.min(40, (groupW / (series.length || 1)) * 0.62);

  if (labels.length === 0 || series.every((s) => s.values.every((v) => v === 0))) {
    return (
      <div className="flex items-center justify-center py-14 text-sm text-[var(--color-text-muted)]">
        {emptyText ?? "Sem dados no período."}
      </div>
    );
  }

  const fmt = formatter ?? ((v: number) => String(v));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block min-w-[520px]">
        {/* Grid */}
        {[0, 0.5, 1].map((t) => {
          const y = PAD_T + innerH - t * innerH;
          return (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="3 3" strokeOpacity="0.5" />
              <text x={PAD_L - 8} y={y + 3} textAnchor="end" className="fill-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
                {fmt(yMax * t)}
              </text>
            </g>
          );
        })}

        {labels.map((label, i) => {
          const groupX = PAD_L + (labels.length > 1 ? (i / (labels.length - 1)) * innerW : innerW / 2);
          const startX = groupX - (series.length * barW) / 2;
          const total = series.reduce((sum, s) => sum + s.values[i], 0);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {series.map((s, j) => {
                const x = startX + j * barW;
                const h = (s.values[i] / yMax) * innerH;
                const y = PAD_T + innerH - h;
                return (
                  <motion.rect
                    key={j}
                    x={x}
                    y={y}
                    width={barW - 4}
                    height={Math.max(h, s.values[i] > 0 ? 2 : 0)}
                    rx={4}
                    fill={s.color}
                    initial={{ opacity: 0, y: PAD_T + innerH }}
                    animate={{ opacity: 1, y }}
                    transition={{ duration: 0.4, delay: i * 0.015 }}
                    className="cursor-pointer"
                  />
                );
              })}
              {hover === i && (
                <rect x={groupX - groupW / 2} y={PAD_T} width={groupW} height={innerH} fill="var(--color-neon-blue)" opacity={0.06} rx={6} />
              )}
              <text x={groupX} y={H - PAD_B + 16} textAnchor="middle" className="fill-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
                {label}
              </text>
              {hover === i && total > 0 && (
                <text x={groupX} y={PAD_T + 10} textAnchor="middle" className="fill-[var(--color-neon-blue)]" style={{ fontSize: 11, fontWeight: 700 }}>
                  {fmt(total)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Legenda horizontal de séries. */
export function MarketingLegend({ series, formatter }: { series: BarSeries[]; formatter?: (v: number) => string }) {
  const fmt = formatter ?? ((v: number) => String(v));
  const totalOf = (s: BarSeries) => s.values.reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
      {series.map((s) => (
        <span key={s.name} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
          {s.name}
          <span className="font-semibold text-[var(--color-text-secondary)]">{fmt(totalOf(s))}</span>
        </span>
      ))}
    </div>
  );
}
