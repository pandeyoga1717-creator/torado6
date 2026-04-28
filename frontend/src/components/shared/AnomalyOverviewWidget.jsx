/** Phase 7D — Anomaly Overview Widget for Executive Dashboard.
 * Shows last N days anomaly counts by severity + type + outlet with deep-link.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck, ChevronRight, Zap, RefreshCw } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES = [
  { v: 7, l: "7d" },
  { v: 14, l: "14d" },
  { v: 30, l: "30d" },
];

const TYPE_COLORS = {
  sales_deviation: "bg-sky-500",
  vendor_price_spike: "bg-violet-500",
  vendor_leadtime: "bg-amber-500",
  ap_cash_spike: "bg-red-500",
};

export default function AnomalyOverviewWidget() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/anomalies/summary", { params: { days } });
      setData(unwrap(res));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [days]); // eslint-disable-line

  const counts = data?.counts || { total: 0, severe: 0, mild: 0, open: 0 };
  const allClean = counts.total === 0 && !loading;

  return (
    <div className="glass-card p-5" data-testid="anomaly-overview-widget">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center",
            counts.severe > 0 ? "bg-red-500/15 text-red-700 dark:text-red-300" :
            counts.mild > 0 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          )}>
            {allClean ? <ShieldCheck className="h-4.5 w-4.5" /> : <AlertTriangle className="h-4.5 w-4.5" />}
          </div>
          <div>
            <h3 className="font-semibold leading-tight">Anomaly Detection</h3>
            <p className="text-[11px] text-muted-foreground">
              Sales, vendor, lead time, kas/AP — last {days}d
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map(r => (
            <button key={r.v} onClick={() => setDays(r.v)}
              className={cn("px-3 py-1 rounded-full text-xs transition-colors",
                days === r.v ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground")}
              data-testid={`anomaly-widget-range-${r.v}`}>
              {r.l}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="h-32 skeleton rounded-xl" />}

      {!loading && allClean && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div className="text-sm">
            <div className="font-semibold text-emerald-700 dark:text-emerald-300">Semua bersih ✨</div>
            <div className="text-[11px] text-muted-foreground">Tidak ada anomaly terdeteksi dalam {days} hari terakhir.</div>
          </div>
        </div>
      )}

      {!loading && !allClean && data && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Tile label="Severe" value={counts.severe} tone="red" testid="anomaly-tile-severe" />
            <Tile label="Mild" value={counts.mild} tone="amber" testid="anomaly-tile-mild" />
            <Tile label="Open" value={counts.open} tone="sky" testid="anomaly-tile-open" />
          </div>

          {/* By-type stacked bar */}
          {(data.by_type || []).length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 tracking-wide">Breakdown per tipe</div>
              <div className="space-y-1.5">
                {data.by_type.map((t) => {
                  const max = Math.max(...data.by_type.map(x => x.total));
                  const pct = max > 0 ? (t.total / max) * 100 : 0;
                  return (
                    <div key={t.type} className="text-xs" data-testid={`anomaly-type-${t.type}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-muted-foreground">{t.label}</span>
                        <span className="font-bold tabular-nums">
                          {t.total}{t.severe > 0 && <span className="text-red-500 ml-1">(+{t.severe} severe)</span>}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                        <div className={cn("h-full", TYPE_COLORS[t.type] || "bg-muted")}
                          style={{ width: `${pct.toFixed(1)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top outlets */}
          {(data.by_outlet || []).length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 tracking-wide">Top outlet</div>
              <div className="space-y-1">
                {data.by_outlet.slice(0, 5).map((o) => (
                  <div key={o.outlet_id}
                    className="flex items-center justify-between text-xs px-2 py-1 rounded glass-input"
                    data-testid={`anomaly-outlet-${o.outlet_code || o.outlet_id}`}>
                    <span className="font-medium">{o.outlet_name}</span>
                    <div className="flex items-center gap-1.5">
                      {o.severe > 0 && <span className="text-[10px] px-1.5 rounded bg-red-500/15 text-red-700">{o.severe}s</span>}
                      {o.mild > 0 && <span className="text-[10px] px-1.5 rounded bg-amber-500/15 text-amber-700">{o.mild}m</span>}
                      <span className="font-bold tabular-nums">{o.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent events */}
          {(data.recent || []).length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 tracking-wide">Terbaru</div>
              <ul className="space-y-1">
                {data.recent.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <Link to={e.link}
                      className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-foreground/5 transition-colors"
                      data-testid={`anomaly-recent-${e.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          e.severity === "severe" ? "bg-red-500" : "bg-amber-500",
                        )} />
                        <span className="truncate">{e.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                        <span className="text-[10px]">{fmtRelative(e.created_at)}</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs">
            {data.last_scan?.updated_at ? (
              <span className="text-muted-foreground">
                Last scan: {fmtRelative(data.last_scan.updated_at)}
              </span>
            ) : (
              <span className="text-muted-foreground">Belum pernah scan</span>
            )}
            <Link to="/finance/anomalies"
              className="inline-flex items-center gap-1 text-foreground hover:underline font-semibold"
              data-testid="anomaly-widget-view-all">
              Buka Feed <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, tone, testid }) {
  const toneClass = {
    red: "text-red-600 dark:text-red-400 bg-red-500/5 border-red-500/20",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/5 border-amber-500/20",
    sky: "text-sky-600 dark:text-sky-400 bg-sky-500/5 border-sky-500/20",
  }[tone] || "";
  return (
    <div className={cn("rounded-xl p-3 border", toneClass)} data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70">{label}</div>
      <div className="text-2xl font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}
