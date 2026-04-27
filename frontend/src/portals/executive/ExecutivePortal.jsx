/** Executive Portal — KPI dashboard + drill-down + AI Insights + Conversational Q&A. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Crown, ArrowRight, TrendingUp, Wallet, ClipboardCheck,
  Receipt, Building2, Layers,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import KpiCard from "@/components/shared/KpiCard";
import AIInsightsCard from "@/components/shared/AIInsightsCard";
import ConversationalQA from "@/components/shared/ConversationalQA";
import SalesTrendChart from "@/components/shared/SalesTrendChart";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { fmtRp, fmtNumber } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const RANGES = [
  { v: 7, l: "7d" },
  { v: 14, l: "14d" },
  { v: 30, l: "30d" },
  { v: 60, l: "60d" },
];

export default function ExecutivePortal() {
  const { user, can } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState(null);
  const [days, setDays] = useState(30);
  const [loadingK, setLoadingK] = useState(true);
  const [loadingT, setLoadingT] = useState(true);

  useEffect(() => {
    api.get("/executive/kpis").then(r => setKpis(unwrap(r))).finally(() => setLoadingK(false));
  }, []);

  useEffect(() => {
    setLoadingT(true);
    api.get("/executive/sales-trend", { params: { days } })
      .then(r => setTrend(unwrap(r)))
      .finally(() => setLoadingT(false));
  }, [days]);

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Executive Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Realtime KPI, trend &amp; AI insights untuk seluruh group.
            </p>
          </div>
        </div>
        {can("ai.chat.use") && <ConversationalQA />}
      </div>

      {loadingK && <LoadingState rows={4} />}

      {!loadingK && kpis && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Sales Hari Ini" value={fmtRp(kpis.sales_today)}
              hint="Validated only" icon={Receipt} color="aurora-1"
              onClick={() => window.location.assign("/outlet/daily-sales")} />
            <KpiCard label="Sales WTD" value={fmtRp(kpis.sales_wtd)}
              hint={`Sejak ${kpis.week_start}`} icon={TrendingUp} color="aurora-2" />
            <KpiCard label="Sales MTD" value={fmtRp(kpis.sales_mtd)}
              hint={`Period ${kpis.period}`} icon={TrendingUp} color="aurora-4" />
            <KpiCard label="Inventory Value" value={fmtRp(kpis.inventory_value)}
              hint={`${fmtNumber(kpis.inventory_item_count)} item`} icon={Layers} color="aurora-5"
              onClick={() => window.location.assign("/inventory/valuation")} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <KpiCard label="AP Exposure" value={fmtRp(kpis.ap_exposure)}
              hint="Unpaid GR" icon={Wallet} color="aurora-6"
              onClick={() => window.location.assign("/finance/ap-aging")} />
            <KpiCard label="Pending Validation" value={kpis.pending_validations}
              hint="Daily sales submitted" icon={ClipboardCheck} color="aurora-3"
              onClick={() => window.location.assign("/finance/validation")} />
            <KpiCard label="Opname Aktif" value={kpis.opname_pending}
              hint="In progress" icon={Building2} color="aurora-1"
              onClick={() => window.location.assign("/inventory/opname")} />
            <Link to="/finance/profit-loss" className="glass-card-hover p-4 flex items-center gap-3" data-testid="exec-pl-link">
              <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center text-white">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs uppercase text-muted-foreground">Buka P&amp;L</div>
                <div className="text-sm font-semibold">Period {kpis.period}</div>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            <div className="glass-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Sales Trend</h3>
                <div className="flex items-center gap-1">
                  {RANGES.map(r => (
                    <button key={r.v} onClick={() => setDays(r.v)}
                      className={cn("px-3 py-1 rounded-full text-xs transition-colors",
                        days === r.v ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground")}
                      data-testid={`exec-range-${r.v}`}
                    >{r.l}</button>
                  ))}
                </div>
              </div>
              {loadingT ? (
                <div className="h-40 skeleton rounded-xl" />
              ) : (
                <SalesTrendChart series={trend?.series || []} height={180} />
              )}
              {trend && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-sm">
                  <span className="text-muted-foreground">Total {days} hari</span>
                  <span className="font-bold tabular-nums">{fmtRp(trend.total)}</span>
                </div>
              )}
            </div>
            <AIInsightsCard />
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Top Outlets — Sales {kpis.period}</h3>
              <Link to="/outlet/daily-sales" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Lihat detail <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {(kpis.top_outlets || []).length === 0 && (
              <div className="text-sm text-muted-foreground italic">Belum ada data sales bulan ini.</div>
            )}
            <div className="space-y-2">
              {(kpis.top_outlets || []).map((o, i) => {
                const pct = kpis.sales_mtd > 0 ? (o.total / kpis.sales_mtd) * 100 : 0;
                return (
                  <div key={o.outlet_id} className="glass-input rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                        <span className="font-medium">{o.outlet_name}</span>
                        <span className="text-xs text-muted-foreground">· {o.days} hari · {fmtNumber(o.trx)} trx</span>
                      </div>
                      <span className="font-bold tabular-nums">{fmtRp(o.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      <div className="h-full grad-aurora" style={{ width: `${Math.min(100, pct).toFixed(1)}%` }} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">{pct.toFixed(1)}% dari total MTD</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
