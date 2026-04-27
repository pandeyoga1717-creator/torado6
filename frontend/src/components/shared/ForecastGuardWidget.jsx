/** Forecast Guard Activity Widget — governance dashboard tile.
 *  Shows count of mild/severe guards triggered in last N days, by outlet, with click-through.
 */
import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, ChevronRight, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RANGES = [
  { v: 7, l: "7d" },
  { v: 14, l: "14d" },
  { v: 30, l: "30d" },
];

export default function ForecastGuardWidget() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/forecasting/guard/activity", { params: { days } });
      setData(unwrap(res));
    } catch {
      setData(null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [days]); // eslint-disable-line

  const total = data?.total ?? 0;
  const allClean = total === 0 && !loading;

  return (
    <div className="glass-card p-5" data-testid="forecast-guard-widget">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center",
            data?.severe_count > 0 ? "bg-red-500/15 text-red-700 dark:text-red-300"
            : data?.mild_count > 0 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          )}>
            {allClean ? <ShieldCheck className="h-4.5 w-4.5" /> : <ShieldAlert className="h-4.5 w-4.5" />}
          </div>
          <div>
            <h3 className="font-semibold leading-tight">Forecast Guard Activity</h3>
            <p className="text-[11px] text-muted-foreground">Pengeluaran yang melewati forecast — last {days}d</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map(r => (
            <button key={r.v} onClick={() => setDays(r.v)}
              className={cn("px-3 py-1 rounded-full text-xs transition-colors",
                days === r.v ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground")}
              data-testid={`fg-widget-range-${r.v}`}>
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
            <div className="text-[11px] text-muted-foreground">Tidak ada pengeluaran yang melewati forecast dalam {days} hari terakhir.</div>
          </div>
        </div>
      )}

      {!loading && !allClean && data && (
        <>
          {/* Summary numbers */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SummaryTile label="Severe" count={data.severe_count} variant="severe" testid="fg-widget-severe" />
            <SummaryTile label="Mild" count={data.mild_count} variant="mild" testid="fg-widget-mild" />
            <SummaryTile label="At Risk"
              valueText={fmtRp(data.total_amount_at_risk)} variant="amount" testid="fg-widget-amount" />
          </div>

          {/* By outlet */}
          {data.by_outlet?.length > 0 && (
            <div className="space-y-1.5 mb-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">By Outlet</div>
              {data.by_outlet.slice(0, 6).map(o => (
                <div key={o.outlet_id || "_consolidated"}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                  data-testid={`fg-widget-outlet-${o.outlet_code || "consolidated"}`}>
                  <span className="text-sm font-medium flex-1 truncate">{o.outlet_name}</span>
                  <Pill count={o.severe} variant="severe" />
                  <Pill count={o.mild} variant="mild" />
                  <span className="text-[11px] tabular-nums text-muted-foreground w-20 text-right">
                    {fmtRp(o.total_amount)}
                  </span>
                  {o.max_deviation_pct > 0 && (
                    <span className="text-[10px] tabular-nums font-semibold text-red-700 dark:text-red-300 w-12 text-right">
                      max +{o.max_deviation_pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recent transactions list */}
          {data.recent?.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5 mt-3">
                Recent
              </div>
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {(showAll ? data.recent : data.recent.slice(0, 4)).map(r => (
                  <RecentRow key={r.id} row={r} />
                ))}
              </div>
              {data.recent.length > 4 && (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
                  data-testid="fg-widget-toggle-all"
                >
                  {showAll ? "Tampilkan lebih sedikit" : `Tampilkan semua (${data.recent.length})`}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, count, valueText, variant, testid }) {
  const styles = {
    severe: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    mild: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    amount: "bg-muted/20 text-foreground border-border/30",
  };
  return (
    <div className={cn("rounded-xl p-3 border", styles[variant])} data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-0.5 truncate">
        {valueText !== undefined ? valueText : (count ?? 0)}
      </div>
    </div>
  );
}

function Pill({ count, variant }) {
  if (!count || count <= 0) return <span className="w-7" />;
  const cls = variant === "severe"
    ? "bg-red-500/20 text-red-800 dark:text-red-200"
    : "bg-amber-500/20 text-amber-800 dark:text-amber-200";
  return (
    <span className={cn(
      "text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
      cls,
    )}>
      {variant === "severe" ? "S" : "M"} {count}
    </span>
  );
}

function RecentRow({ row }) {
  const isSevere = row.severity === "severe";
  const link = row.link || "#";
  const Wrapper = link === "#" ? "div" : Link;
  const wrapperProps = link === "#" ? {} : { to: link };
  return (
    <Wrapper {...wrapperProps}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/15 hover:bg-muted/35 transition-colors group">
      <AlertTriangle
        className={cn("h-3.5 w-3.5 flex-shrink-0",
          isSevere ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono opacity-80">{row.source_doc_no || row.source_id?.slice(0, 8)}</span>
          <span className="text-[10px] uppercase tracking-wider opacity-60">{row.source_type?.replace("_", " ")}</span>
          <span className="text-[10px] opacity-60">·</span>
          <span className="text-[10px] truncate opacity-80">{row.outlet_name}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <span className="tabular-nums font-semibold text-foreground">{fmtRp(row.amount)}</span>
          <span>·</span>
          <span className={cn("font-semibold tabular-nums",
            isSevere ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300")}>
            +{Math.abs(row.deviation_pct).toFixed(1)}%
          </span>
          <span>·</span>
          <span>{fmtRelative(row.created_at)}</span>
          {row.reason && (
            <>
              <span>·</span>
              <span className="italic truncate" title={row.reason}>{row.reason.slice(0, 40)}{row.reason.length > 40 ? "…" : ""}</span>
            </>
          )}
        </div>
      </div>
      {link !== "#" && (
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
      )}
    </Wrapper>
  );
}
