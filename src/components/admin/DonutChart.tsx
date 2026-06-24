"use client";

import { useState, useMemo } from "react";
import { PieChart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string; // CSS color (hex or var())
}

interface DonutChartProps {
  data: DonutSlice[];
  /** Rótulo exibido no centro do anel (ex.: "Total"). */
  centerLabel?: string;
}

const SIZE = 220;
const STROKE = 30;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;

function polar(angleDeg: number, radius: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

function arcPath(startAngle: number, endAngle: number) {
  const start = polar(endAngle, R);
  const end = polar(startAngle, R);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function DonutChart({ data, centerLabel = "Total" }: DonutChartProps) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const { slices, total } = useMemo(() => {
    const positive = data.filter((d) => d.value > 0);
    const total = positive.reduce((a, b) => a + b.value, 0);
    const fracs = positive.map((d) => (total > 0 ? d.value / total : 0));
    // soma de prefixo (sem reatribuir variável capturada — regra do React Compiler)
    const slices = positive.map((d, i) => {
      const startFrac = fracs.slice(0, i).reduce((a, b) => a + b, 0);
      return { ...d, frac: fracs[i], start: startFrac * 360, end: (startFrac + fracs[i]) * 360 };
    });
    return { slices, total };
  }, [data]);

  if (slices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <PieChart className="w-10 h-10 text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-muted)]">
          Selecione ao menos uma métrica com valor para exibir.
        </p>
      </div>
    );
  }

  const hover = hoverKey ? slices.find((s) => s.key === hoverKey) ?? null : null;
  const single = slices.length === 1;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full -rotate-0">
          {/* trilho de fundo */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="var(--color-border)"
            strokeOpacity={0.4}
            strokeWidth={STROKE}
          />
          {single ? (
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={slices[0].color}
              strokeWidth={STROKE}
              strokeOpacity={hoverKey && hoverKey !== slices[0].key ? 0.35 : 1}
              onMouseEnter={() => setHoverKey(slices[0].key)}
              onMouseLeave={() => setHoverKey(null)}
              style={{ transition: "stroke-opacity 0.15s" }}
            />
          ) : (
            slices.map((s) => (
              <path
                key={s.key}
                d={arcPath(s.start, s.end)}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeLinecap="butt"
                strokeOpacity={hoverKey && hoverKey !== s.key ? 0.35 : 1}
                onMouseEnter={() => setHoverKey(s.key)}
                onMouseLeave={() => setHoverKey(null)}
                style={{ cursor: "pointer", transition: "stroke-opacity 0.15s" }}
              />
            ))
          )}
        </svg>

        {/* Centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            {hover ? hover.label : centerLabel}
          </p>
          <p className="text-xl font-black text-[var(--color-text-primary)] leading-tight">
            {formatCurrency(hover ? hover.value : total)}
          </p>
          {hover && (
            <p className="text-[11px] font-bold" style={{ color: hover.color }}>
              {(hover.frac * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex-1 w-full grid grid-cols-1 gap-1.5">
        {slices.map((s) => (
          <button
            key={s.key}
            type="button"
            onMouseEnter={() => setHoverKey(s.key)}
            onMouseLeave={() => setHoverKey(null)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--color-bg-overlay)]"
            style={{ opacity: hoverKey && hoverKey !== s.key ? 0.5 : 1 }}
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">{s.label}</span>
            <span className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">
              {formatCurrency(s.value)}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] tabular-nums w-12 text-right">
              {(s.frac * 100).toFixed(1)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
