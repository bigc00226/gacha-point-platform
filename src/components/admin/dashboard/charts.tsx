import { formatNumber } from "@/lib/format";

/** Small, dependency-free SVG charts for the admin dashboard. */

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

/** Vertical bars (one or more series side by side) with a y-axis and value titles. */
export function BarChart({ labels, series, height = 220, unit = "" }: { labels: string[]; series: Series[]; height?: number; unit?: string }) {
  const width = 640;
  const pad = { top: 16, right: 12, bottom: 28, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const groupW = innerW / labels.length;
  const barW = Math.min(28, (groupW * 0.7) / series.length);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join("・")}>
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--subtle)">
                {formatNumber(Math.round(t))}
              </text>
            </g>
          );
        })}
        {labels.map((label, i) => {
          const gx = pad.left + i * groupW + groupW / 2;
          const totalW = barW * series.length + (series.length - 1) * 4;
          return (
            <g key={label}>
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const h = (v / max) * innerH;
                const x = gx - totalW / 2 + si * (barW + 4);
                return (
                  <rect key={s.key} x={x} y={pad.top + innerH - h} width={barW} height={Math.max(0, h)} rx={4} fill={s.color}>
                    <title>{`${label} ${s.label}: ${formatNumber(v)}${unit}`}</title>
                  </rect>
                );
              })}
              <text x={gx} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for a breakdown (label + value). */
export function HBarList({ items, color, unit = "" }: { items: Array<{ key: string; label: string; value: number }>; color: string; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted">{i.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </span>
          <span className="tabular w-20 text-right font-bold">
            {formatNumber(i.value)}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
