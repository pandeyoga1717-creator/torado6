/** AI Insights card — trend bullets + anomaly detection. Non-blocking; renders empty if AI unavailable. */
import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function AIInsightsCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const res = await api.get("/executive/insights");
      setData(unwrap(res));
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="glass-card p-5 relative overflow-hidden" data-testid="ai-insights-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl grad-aurora flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold">AI Insights</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/10 text-muted-foreground uppercase tracking-wider">
            Beta
          </span>
        </div>
        <Button onClick={load} disabled={refreshing} size="sm" variant="outline" className="rounded-full gap-1 h-7 px-3">
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} /> Refresh
        </Button>
      </div>

      {loading && <div className="h-24 skeleton rounded-xl" />}

      {!loading && data && (
        <div className="space-y-4">
          {/* Trend bullets */}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" /> Sales Trend (7v7)
            </div>
            <ul className="space-y-1.5 text-sm">
              {(data.trend?.bullets || []).map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-foreground/40 mt-0.5">•</span>
                  <span>{b}</span>
                </li>
              ))}
              {data.trend && data.trend.delta_pct != null && (
                <li className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                  <span>7 hari terakhir: {fmtRp(data.trend.last_7_total || 0)}</span>
                  <span className={cn(data.trend.delta_pct >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {data.trend.delta_pct >= 0 ? "+" : ""}{data.trend.delta_pct.toFixed(1)}%
                  </span>
                </li>
              )}
            </ul>
          </div>

          {/* Anomalies */}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Anomali
            </div>
            <p className="text-sm text-muted-foreground italic">{data.anomalies?.summary}</p>
            {(data.anomalies?.anomalies || []).slice(0, 3).map((a, i) => (
              <div key={i} className="glass-input rounded-xl px-3 py-2 mt-2 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{a.date}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {a.direction === "high" ? "Tinggi" : "Rendah"} (z={a.z_score}σ)
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{fmtRp(a.total)}</div>
                  <div className={cn("text-[11px]", a.deviation_pct >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {a.deviation_pct >= 0 ? "+" : ""}{a.deviation_pct.toFixed(1)}% vs rata2
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
