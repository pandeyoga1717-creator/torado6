/** Phase 7C — 3-month Forecasting (linear regression + EWMA + hybrid). */
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, Sparkles, Info } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const METHOD_COLORS = {
  linear: "#10b981",   // emerald
  ewma: "#f59e0b",     // amber
  hybrid: "#7c4cc4",   // aurora purple
};

function mapeColor(mape) {
  if (mape == null) return "text-muted-foreground bg-muted/40";
  if (mape <= 10) return "text-emerald-700 bg-emerald-500/15 dark:text-emerald-300";
  if (mape <= 20) return "text-amber-700 bg-amber-500/15 dark:text-amber-300";
  return "text-red-700 bg-red-500/15 dark:text-red-300";
}

export default function Forecasting() {
  const [methodsCatalog, setMethodsCatalog] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [target, setTarget] = useState("sales");
  const [outletId, setOutletId] = useState("");
  const [months, setMonths] = useState(3);
  const [method, setMethod] = useState("hybrid");
  const [historyDays, setHistoryDays] = useState(90);

  const [data, setData] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/forecasting/methods").then(r => setMethodsCatalog(unwrap(r))),
      api.get("/master/outlets", { params: { per_page: 100 } }).then(r => setOutlets(unwrap(r) || [])),
    ]).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [main, dash] = await Promise.all([
        api.get(`/forecasting/${target}`, {
          params: { outlet_id: outletId || undefined, months, method, history_days: historyDays },
        }),
        target === "sales"
          ? api.get("/forecasting/dashboard", { params: { months, method } })
          : Promise.resolve(null),
      ]);
      setData(unwrap(main));
      setDashboard(dash ? unwrap(dash) : null);
    } catch (e) {
      toast.error("Gagal load forecast: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [target, outletId, months, method, historyDays]); // eslint-disable-line

  if (!methodsCatalog) return <LoadingState rows={3} />;

  return (
    <div className="space-y-4" data-testid="forecasting-page">
      {/* Filter bar */}
      <div className="glass-card p-4 grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Target</Label>
          <select value={target} onChange={e => setTarget(e.target.value)}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="forecast-target">
            {methodsCatalog.targets.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <select value={outletId} onChange={e => setOutletId(e.target.value)}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="forecast-outlet">
            <option value="">Consolidated (All)</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Method</Label>
          <div className="flex gap-1 mt-1">
            {methodsCatalog.methods.map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className={cn(
                  "px-2.5 py-1.5 rounded-full text-xs font-semibold flex-1 transition-colors capitalize",
                  method === m.key
                    ? "grad-aurora text-white"
                    : "bg-muted/30 text-muted-foreground hover:text-foreground",
                )}
                data-testid={`forecast-method-${m.key}`}>
                {m.key}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Months Ahead</Label>
          <div className="flex gap-1 mt-1">
            {[1, 3, 6].map(m => (
              <button key={m} onClick={() => setMonths(m)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold flex-1 transition-colors",
                  months === m ? "bg-foreground text-background" : "bg-muted/30 text-muted-foreground hover:text-foreground",
                )}
                data-testid={`forecast-months-${m}`}>
                {m}M
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">History (days)</Label>
          <Input type="number" value={historyDays}
            onChange={e => setHistoryDays(Math.max(14, Math.min(365, +e.target.value || 90)))}
            className="glass-input mt-1 h-9" min={14} max={365} data-testid="forecast-history-days" />
        </div>
        <div className="text-xs text-muted-foreground self-center">
          {methodsCatalog.methods.find(m => m.key === method)?.description}
        </div>
      </div>

      {loading && <LoadingState rows={6} />}

      {!loading && data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Activity}
              label={`History ${data.filters.history_days}d`}
              value={fmtRp(data.totals.history_total)}
              hint={`Avg ${fmtRp(data.totals.history_avg_daily)}/day`}
              testid="forecast-history-kpi"
            />
            <KpiCard
              icon={Target}
              label={`Forecast ${months}M`}
              value={fmtRp(data.totals.forecast_total)}
              hint={`Avg ${fmtRp(data.totals.forecast_avg_daily)}/day`}
              highlight
              testid="forecast-total-kpi"
            />
            <GrowthCard pct={data.totals.growth_pct} band={data.confidence_band} testid="forecast-growth-kpi" />
            <AccuracyCard mape={data.accuracy_mape} method={data.method} testid="forecast-accuracy-kpi" />
          </div>

          {/* Main chart */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <h3 className="font-semibold">
                  {target === "sales" ? "Sales" : "Expense"} — Historical &amp; Forecast
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <LegendDot color="#94a3b8" label="History" />
                <LegendDot color={METHOD_COLORS[data.method]} label={`Forecast (${data.method})`} dashed />
                <LegendDot color={METHOD_COLORS[data.method]} label="Confidence band" opacity={0.2} swatch />
              </div>
            </div>
            <ForecastChart history={data.history_daily} forecast={data.forecast_daily}
              band={data.confidence_band} color={METHOD_COLORS[data.method]} />
          </div>

          {/* Monthly bars */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Monthly Forecast — Next {months} {months === 1 ? "month" : "months"}</h3>
              <Badge className="bg-muted/40 text-foreground border-0 text-xs">
                Method: <span className="capitalize ml-1">{data.method}</span>
              </Badge>
            </div>
            <MonthlyBars history={data.monthly_history} forecast={data.monthly_forecast}
              color={METHOD_COLORS[data.method]} />
          </div>

          {/* Method comparison */}
          <div className="glass-card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Method Comparison (3-month forecast total)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(data.comparison_methods).map(([m, fc]) => {
                const total = fc.reduce((s, r) => s + r.value, 0);
                const isActive = m === data.method;
                return (
                  <div key={m} className={cn(
                    "rounded-xl p-4 border transition-all",
                    isActive ? "border-2" : "border-border/30",
                  )}
                    style={isActive ? { borderColor: METHOD_COLORS[m] } : undefined}
                    data-testid={`forecast-compare-${m}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: METHOD_COLORS[m] }} />
                      <span className="text-sm font-semibold capitalize">{m}</span>
                      {isActive && <Badge className="ml-auto bg-foreground text-background text-[10px] h-4">active</Badge>}
                    </div>
                    <div className="text-xl font-bold tabular-nums">{fmtRp(total)}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {fc.map(f => f.period.slice(5)).join(" / ")}: {fc.map(f => `${(f.value / 1e6).toFixed(0)}M`).join(" / ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-outlet dashboard (only for sales + consolidated) */}
          {target === "sales" && dashboard && !outletId && (
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-3">Per-Outlet Forecast Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left">Outlet</th>
                      <th className="px-3 py-2 text-right">History {historyDays}d</th>
                      <th className="px-3 py-2 text-right">Forecast {months}M</th>
                      <th className="px-3 py-2 text-right">Growth</th>
                      <th className="px-3 py-2 text-right">±Band</th>
                      <th className="px-3 py-2 text-right">MAPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.outlets.map(o => (
                      <tr key={o.outlet_id} className="border-b border-border/20 hover:bg-muted/20"
                        data-testid={`outlet-row-${o.outlet_code || o.outlet_id}`}>
                        <td className="px-3 py-2 font-medium">{o.outlet_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtRp(o.history_total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">{fmtRp(o.forecast_total)}</td>
                        <td className="px-3 py-2 text-right">
                          <GrowthBadge pct={o.growth_pct} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">±{fmtRp(o.confidence_band)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold", mapeColor(o.accuracy_mape))}>
                            {o.accuracy_mape == null ? "—" : `${o.accuracy_mape}%`}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-bold border-t-2 border-border">
                      <td className="px-3 py-2">Group Consolidated</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtRp(dashboard.consolidated.history_total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtRp(dashboard.consolidated.forecast_total)}</td>
                      <td className="px-3 py-2 text-right"><GrowthBadge pct={dashboard.consolidated.growth_pct} /></td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">±{fmtRp(dashboard.consolidated.confidence_band)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold", mapeColor(dashboard.consolidated.accuracy_mape))}>
                          {dashboard.consolidated.accuracy_mape == null ? "—" : `${dashboard.consolidated.accuracy_mape}%`}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/20 border border-border/30">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div>
              Forecast adalah <span className="font-semibold">estimasi statistik</span> dari pola historis. MAPE ≤10% sangat akurat, ≤20% bagus, &gt;20% data masih volatil.
              Gunakan rentang confidence band (±) sebagai range realistis. Method <span className="font-semibold capitalize">{data.method}</span>: {methodsCatalog.methods.find(m => m.key === data.method)?.description}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============== Sub-components ==============

function KpiCard({ icon: Icon, label, value, hint, highlight, testid }) {
  return (
    <div className={cn("glass-card p-4", highlight && "border-2 border-primary/30")} data-testid={testid}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function GrowthCard({ pct, band, testid }) {
  const positive = pct > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? "text-emerald-700 dark:text-emerald-400"
    : pct < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground";
  return (
    <div className="glass-card p-4" data-testid={testid}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Growth vs History</div>
      <div className={cn("text-2xl font-bold tabular-nums flex items-center gap-2", color)}>
        <Icon className="h-5 w-5" />
        {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct}%`}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">±{fmtRp(band)} (95% CI)</div>
    </div>
  );
}

function AccuracyCard({ mape, method, testid }) {
  const grade = mape == null ? "n/a" : mape <= 10 ? "Excellent" : mape <= 20 ? "Good" : mape <= 35 ? "Fair" : "Volatile";
  return (
    <div className="glass-card p-4" data-testid={testid}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Backtest Accuracy</div>
      <div className="text-2xl font-bold tabular-nums">
        {mape == null ? "—" : `${mape}%`}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">
        MAPE on last 30d ({method}) — <span className="font-semibold">{grade}</span>
      </div>
    </div>
  );
}

function GrowthBadge({ pct }) {
  if (pct == null) return <span className="text-muted-foreground">—</span>;
  const positive = pct > 0;
  const cls = positive ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
    : pct < 0 ? "text-red-700 dark:text-red-400 bg-red-500/10"
    : "text-muted-foreground bg-muted/40";
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold tabular-nums", cls)}>
      {positive ? "+" : ""}{pct}%
    </span>
  );
}

function LegendDot({ color, label, dashed, swatch, opacity = 1 }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      {swatch ? (
        <span className="w-4 h-3 rounded-sm" style={{ background: color, opacity }} />
      ) : (
        <span
          className={cn("w-4 h-0.5", dashed ? "border-t-2 border-dashed" : "")}
          style={{ background: dashed ? "transparent" : color, borderColor: color }}
        />
      )}
      {label}
    </span>
  );
}

// ============== Charts ==============

function ForecastChart({ history, forecast, band, color }) {
  const chartData = useMemo(() => {
    const all = [
      ...history.map(d => ({ ...d, type: "history" })),
      ...forecast.map(d => ({ ...d, type: "forecast" })),
    ];
    if (all.length === 0) return null;
    const max = Math.max(...all.map(d => d.value + (d.type === "forecast" ? band : 0)), 1);
    const min = 0;
    return { all, max, min, historyLen: history.length };
  }, [history, forecast, band]);

  if (!chartData) return <div className="text-sm text-muted-foreground italic">Tidak ada data</div>;

  const { all, max, historyLen } = chartData;
  const W = 1000, H = 240, PAD_L = 70, PAD_B = 20, PAD_T = 10;
  const innerW = W - PAD_L - 10, innerH = H - PAD_T - PAD_B;
  const xStep = innerW / Math.max(1, all.length - 1);

  const xy = (i, v) => [PAD_L + i * xStep, PAD_T + innerH - (v / max) * innerH];

  const historyPath = history.map((d, i) => `${i === 0 ? "M" : "L"} ${xy(i, d.value).join(" ")}`).join(" ");
  const forecastPath = forecast.map((d, i) => {
    const idx = historyLen + i;
    return `${i === 0 ? "M" : "L"} ${xy(idx, d.value).join(" ")}`;
  }).join(" ");

  // Confidence band polygon (forecast only)
  const bandUpper = forecast.map((d, i) => xy(historyLen + i, d.value + band));
  const bandLower = forecast.map((d, i) => xy(historyLen + i, Math.max(0, d.value - band)));
  const bandPath = "M " + bandUpper.map(p => p.join(" ")).join(" L ")
    + " L " + bandLower.reverse().map(p => p.join(" ")).join(" L ") + " Z";

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => max * t);

  // X-axis labels (~6 across)
  const xLabelEvery = Math.max(1, Math.floor(all.length / 7));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[280px]" data-testid="forecast-chart">
        {/* Grid + Y labels */}
        {yTicks.map((t, i) => {
          const y = PAD_T + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - 10} y2={y}
                stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 4" />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="10" className="fill-current opacity-60 tabular-nums">
                {(t / 1e6).toFixed(0)}M
              </text>
            </g>
          );
        })}

        {/* Vertical line at history/forecast boundary */}
        {(() => {
          const [bx] = xy(historyLen - 0.5, 0);
          return (
            <g>
              <line x1={bx} y1={PAD_T} x2={bx} y2={PAD_T + innerH}
                stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" />
              <text x={bx + 4} y={PAD_T + 12} fontSize="10" className="fill-current opacity-60">today</text>
            </g>
          );
        })()}

        {/* Confidence band */}
        <path d={bandPath} fill={color} opacity="0.15" />

        {/* History line */}
        <path d={historyPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Forecast line (dashed) */}
        <path d={forecastPath} fill="none" stroke={color} strokeWidth="2" strokeDasharray="5 4" />

        {/* X labels */}
        {all.map((d, i) => {
          if (i % xLabelEvery !== 0) return null;
          const [x] = xy(i, 0);
          return (
            <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="9"
              className="fill-current opacity-60">{d.date.slice(5)}</text>
          );
        })}
      </svg>
    </div>
  );
}

function MonthlyBars({ history, forecast, color }) {
  const all = [
    ...history.map(h => ({ ...h, type: "history" })),
    ...forecast.map(f => ({ ...f, type: "forecast" })),
  ];
  if (all.length === 0) return <div className="text-sm text-muted-foreground italic">Tidak ada data</div>;
  const max = Math.max(...all.map(r => r.value), 1);

  return (
    <div className="flex items-end gap-3 h-44 overflow-x-auto pb-2">
      {all.map(r => {
        const h = (r.value / max) * 140;
        return (
          <div key={r.period} className="flex flex-col items-center gap-1.5 min-w-[60px]" data-testid={`month-bar-${r.period}`}>
            <div className="text-[10px] tabular-nums text-foreground font-semibold">{(r.value / 1e6).toFixed(0)}M</div>
            <div className="w-12 rounded-t-md transition-all"
              style={{
                height: `${Math.max(4, h)}px`,
                background: r.type === "forecast" ? color : "rgba(148, 163, 184, 0.5)",
                borderTopLeftRadius: 6, borderTopRightRadius: 6,
                opacity: r.type === "forecast" ? 0.85 : 1,
                ...(r.type === "forecast" ? { borderTop: `3px solid ${color}` } : {}),
              }}
            />
            <div className={cn("text-[10px]", r.type === "forecast" ? "font-bold" : "text-muted-foreground")}>
              {r.period.slice(2)}
            </div>
            {r.type === "forecast" && (
              <span className="text-[9px] uppercase font-semibold tracking-wider"
                style={{ color }}>forecast</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
