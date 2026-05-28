"use client";

import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface ChartPoint {
  label: string;     // X axis label (e.g. "12/03" or "Mar")
  fullLabel: string; // Tooltip label (e.g. "12 de Março, 2026")
  value: number;     // Revenue
}

interface RevenueChartProps {
  data: ChartPoint[];
  loading?: boolean;
}

const CHART_W = 720;
const CHART_H = 280;
const PAD_L = 60;
const PAD_R = 24;
const PAD_T = 30;
const PAD_B = 40;

function niceMax(n: number): number {
  if (n <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / mag;
  if (f <= 1) return mag;
  if (f <= 2) return 2 * mag;
  if (f <= 5) return 5 * mag;
  return 10 * mag;
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { points, yMax, gridLines, total, avg, peak, trend } = useMemo(() => {
    if (data.length === 0) {
      return { points: [], yMax: 100, gridLines: [], total: 0, avg: 0, peak: null as ChartPoint | null, trend: 0 };
    }

    const max = Math.max(...data.map((d) => d.value), 1);
    const yMax = niceMax(max * 1.1);
    const innerW = CHART_W - PAD_L - PAD_R;
    const innerH = CHART_H - PAD_T - PAD_B;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

    const points = data.map((d, i) => ({
      ...d,
      x: PAD_L + (data.length === 1 ? innerW / 2 : i * stepX),
      y: PAD_T + innerH - (d.value / yMax) * innerH,
    }));

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: PAD_T + innerH - t * innerH,
      value: yMax * t,
    }));

    const total = data.reduce((a, b) => a + b.value, 0);
    const avg = total / data.length;
    const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);

    // Trend: average of first half vs. second half
    const half = Math.floor(data.length / 2);
    const firstHalfAvg = data.slice(0, half).reduce((a, b) => a + b.value, 0) / Math.max(half, 1);
    const secondHalfAvg = data.slice(half).reduce((a, b) => a + b.value, 0) / Math.max(data.length - half, 1);
    const trend = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

    return { points, yMax, gridLines, total, avg, peak, trend };
  }, [data]);

  /* Smooth path via cubic bezier */
  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cpx = (p0.x + p1.x) / 2;
      d += ` C ${cpx},${p0.y} ${cpx},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    return `${linePath} L ${points[points.length - 1].x},${CHART_H - PAD_B} L ${points[0].x},${CHART_H - PAD_B} Z`;
  }, [linePath, points]);

  /* Hover handling — map mouse X to nearest point */
  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = CHART_W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - mouseX);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    });
    setHoverIdx(nearestIdx);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-72 rounded-xl" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Calendar className="w-10 h-10 text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-muted)]">Sem dados para exibir neste período.</p>
      </div>
    );
  }

  const hover = hoverIdx !== null ? points[hoverIdx] : null;
  const trendUp = trend >= 0;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total" value={formatCurrency(total)} accent="text-[var(--color-neon-blue)]" />
        <StatTile label="Média" value={formatCurrency(avg)} accent="text-emerald-400" />
        <StatTile
          label="Pico"
          value={peak ? formatCurrency(peak.value) : "—"}
          hint={peak?.fullLabel}
          accent="text-purple-400"
        />
        <StatTile
          label="Tendência"
          value={`${trendUp ? "+" : ""}${trend.toFixed(1)}%`}
          accent={trendUp ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}
          icon={trendUp ? TrendingUp : TrendingDown}
        />
      </div>

      {/* Chart */}
      <div className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2">
        <div className="w-full overflow-x-auto">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="w-full h-auto block min-w-[420px]"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Gradient defs */}
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--color-neon-blue)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-neon-blue)" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="revenue-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="var(--color-electric-blue)" />
                <stop offset="100%" stopColor="var(--color-neon-cyan)" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {gridLines.map((g, i) => (
              <g key={i}>
                <line
                  x1={PAD_L} x2={CHART_W - PAD_R}
                  y1={g.y} y2={g.y}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                  strokeOpacity="0.5"
                />
                <text
                  x={PAD_L - 8} y={g.y + 3}
                  textAnchor="end"
                  className="fill-[var(--color-text-muted)]"
                  style={{ fontSize: 10 }}
                >
                  {g.value >= 1000 ? `${(g.value / 1000).toFixed(0)}k` : g.value.toFixed(0)}
                </text>
              </g>
            ))}

            {/* X axis labels — show ~6 evenly spaced */}
            {points.map((p, i) => {
              const step = Math.max(1, Math.ceil(points.length / 6));
              if (i % step !== 0 && i !== points.length - 1) return null;
              return (
                <text
                  key={i}
                  x={p.x} y={CHART_H - PAD_B + 18}
                  textAnchor="middle"
                  className="fill-[var(--color-text-muted)]"
                  style={{ fontSize: 10 }}
                >
                  {p.label}
                </text>
              );
            })}

            {/* Area fill */}
            <motion.path
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              d={areaPath}
              fill="url(#revenue-fill)"
            />

            {/* Line */}
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              d={linePath}
              fill="none"
              stroke="url(#revenue-stroke)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Hover guides */}
            {hover && (
              <g>
                <line
                  x1={hover.x} x2={hover.x}
                  y1={PAD_T} y2={CHART_H - PAD_B}
                  stroke="var(--color-neon-blue)"
                  strokeOpacity="0.4"
                  strokeDasharray="2 3"
                />
                <circle
                  cx={hover.x} cy={hover.y}
                  r={5}
                  fill="var(--color-bg-base)"
                  stroke="var(--color-neon-blue)"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        </div>

        {/* Tooltip */}
        {hover && (
          <div
            className="absolute pointer-events-none rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-neon-blue)]/40 shadow-[var(--shadow-elevated)] px-3 py-2 min-w-[140px]"
            style={{
              left: `${(hover.x / CHART_W) * 100}%`,
              top: 8,
              transform: hover.x > CHART_W * 0.7
                ? "translateX(-100%)"
                : hover.x < CHART_W * 0.2
                ? "translateX(0)"
                : "translateX(-50%)",
            }}
          >
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
              {hover.fullLabel}
            </p>
            <p className="text-sm font-bold text-[var(--color-neon-blue)] mt-0.5">
              {formatCurrency(hover.value)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label, value, accent, hint, icon: Icon,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${accent}`} />}
        <span className={`text-sm font-bold ${accent} truncate`}>{value}</span>
      </div>
      {hint && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">{hint}</p>}
    </div>
  );
}
