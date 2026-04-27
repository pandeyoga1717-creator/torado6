/** Sales trend mini-chart (SVG, no chart lib). Receives series of {date,total}. */
import { useMemo } from "react";
import { fmtRp, fmtDate } from "@/lib/format";

export default function SalesTrendChart({ series = [], height = 160 }) {
  const { points, max, min, lastDate, lastTotal, mean } = useMemo(() => {
    if (!series.length) return { points: [], max: 0, min: 0, lastDate: "", lastTotal: 0, mean: 0 };
    const totals = series.map(s => s.total);
    const max = Math.max(...totals, 1);
    const min = Math.min(...totals);
    const sum = totals.reduce((a, b) => a + b, 0);
    const mean = sum / totals.length;
    const w = 800;
    const h = height;
    const stepX = w / (series.length - 1 || 1);
    const norm = (v) => {
      if (max === min) return h / 2;
      return h - ((v - min) / (max - min)) * (h - 16) - 8;
    };
    const points = series.map((s, i) => ({
      x: i * stepX,
      y: norm(s.total),
      total: s.total,
      date: s.date,
      trx: s.trx,
    }));
    return { points, max, min, lastDate: series[series.length - 1]?.date, lastTotal: totals[totals.length - 1], mean };
  }, [series, height]);

  if (!series.length) {
    return <div className="text-sm text-muted-foreground italic">Tidak ada data trend.</div>;
  }

  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");
  const areaPath = `M0,${height} L${polyline.replaceAll(" ", " L")} L${(points[points.length - 1] || { x: 0 }).x},${height} Z`;

  return (
    <div className="w-full" data-testid="sales-trend-chart">
      <svg viewBox={`0 0 800 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--aurora-1))" stopOpacity="0.45" />
            <stop offset="100%" stopColor="hsl(var(--aurora-1))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trendGrad)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="hsl(var(--aurora-1))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2} fill="hsl(var(--aurora-1))">
            <title>{`${fmtDate(p.date)}: ${fmtRp(p.total)} (${p.trx} trx)`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{fmtDate(series[0].date)}</span>
        <span>Avg: <span className="text-foreground font-medium">{fmtRp(Math.round(mean))}</span></span>
        <span>{fmtDate(lastDate)} · <span className="text-foreground font-medium">{fmtRp(lastTotal)}</span></span>
      </div>
    </div>
  );
}
