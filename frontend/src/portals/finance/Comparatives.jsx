/** Comparatives — MoM/YoY metric comparison with rolling 12m sparkline. */
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Comparatives() {
  const [catalog, setCatalog] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);

  const [metric, setMetric] = useState("sales");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [compareTo, setCompareTo] = useState("mom");
  const [outletId, setOutletId] = useState("");
  const [brandId, setBrandId] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/reports/catalog").then(r => setCatalog(unwrap(r))),
      api.get("/master/outlets", { params: { per_page: 100 } }).then(r => setOutlets(unwrap(r) || [])),
      api.get("/master/brands", { params: { per_page: 100 } }).then(r => setBrands(unwrap(r) || [])),
    ]).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { metric, period, compare_to: compareTo };
      if (outletId) params.outlet_ids = outletId;
      if (brandId) params.brand_ids = brandId;
      const r = await api.get("/reports/comparatives", { params });
      setData(unwrap(r));
    } catch (e) {
      toast.error("Gagal load comparatives: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setLoading(false); }
  }
  useEffect(() => { if (catalog) load(); }, [metric, period, compareTo, outletId, brandId, catalog]); // eslint-disable-line

  if (!catalog) return <LoadingState rows={3} />;

  const isCount = metric === "transaction_count" || metric === "po_count" || metric === "gr_count";
  const fmt = isCount ? fmtNumber : fmtRp;

  return (
    <div className="space-y-4" data-testid="comparatives-page">
      <div className="glass-card p-4 grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Metric</Label>
          <select value={metric} onChange={e => setMetric(e.target.value)}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="comp-metric">
            {catalog.metrics.map(m => <option key={m.key} value={m.key}>{m.key}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Period</Label>
          <Input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="comp-period" />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Compare</Label>
          <div className="flex gap-1 mt-1">
            {["mom", "yoy"].map(c => (
              <button key={c} onClick={() => setCompareTo(c)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold flex-1 transition-colors",
                  compareTo === c
                    ? "grad-aurora text-white"
                    : "bg-muted/30 text-muted-foreground hover:text-foreground",
                )}
                data-testid={`comp-${c}`}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <select value={outletId} onChange={e => setOutletId(e.target.value)}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="comp-outlet">
            <option value="">All outlets</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Brand</Label>
          <select value={brandId} onChange={e => setBrandId(e.target.value)}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="comp-brand">
            <option value="">All brands</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <LoadingState rows={4} />}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard label={`Period ${data.period}`} value={fmt(data.current)} highlight testid="comp-current" />
            <KpiCard label={`Previous ${data.previous_period}`} value={fmt(data.previous)} testid="comp-previous" />
            <DeltaCard delta={data.delta} pct={data.delta_pct} fmt={fmt} compareTo={data.compare_to} />
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Rolling 12 months — {metric}</h3>
              <span className="text-xs text-muted-foreground">{data.compare_to.toUpperCase()}</span>
            </div>
            <Sparkline data={data.rolling_12m || []} fmt={fmt} highlightPeriod={data.period} />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, highlight, testid }) {
  return (
    <div className={cn("glass-card p-5", highlight && "border-2 border-primary/30")} data-testid={testid}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl lg:text-3xl font-bold tabular-nums mt-2">{value}</div>
    </div>
  );
}

function DeltaCard({ delta, pct, fmt, compareTo }) {
  const positive = delta > 0;
  const negative = delta < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  const color = positive ? "text-emerald-700 dark:text-emerald-400"
    : negative ? "text-red-700 dark:text-red-400" : "text-muted-foreground";
  return (
    <div className="glass-card p-5" data-testid="comp-delta">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Δ {compareTo.toUpperCase()}</div>
      <div className={cn("text-2xl lg:text-3xl font-bold tabular-nums mt-2 flex items-center gap-2", color)}>
        <Icon className="h-6 w-6" />
        {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct}%`}
      </div>
      <div className="text-sm mt-1 text-muted-foreground tabular-nums">
        {delta >= 0 ? "+" : ""}{fmt(delta)}
      </div>
    </div>
  );
}

function Sparkline({ data, fmt, highlightPeriod }) {
  if (!data?.length) return <div className="text-sm text-muted-foreground italic">Tidak ada data</div>;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-1.5 h-40 px-2 pb-1 overflow-x-auto">
      {data.map((d, i) => {
        const h = max === 0 ? 4 : Math.max(4, ((d.value - min) / range) * 140);
        const isHi = d.period === highlightPeriod;
        return (
          <div key={d.period} className="flex flex-col items-center gap-1 group min-w-[42px]">
            <div className="text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              {fmt(d.value)}
            </div>
            <div
              className={cn(
                "w-7 rounded-t transition-all",
                isHi ? "grad-aurora" : "bg-foreground/30 group-hover:bg-foreground/60",
              )}
              style={{ height: `${h}px` }}
              data-testid={`spark-${d.period}`}
            />
            <div className={cn("text-[10px]", isHi ? "font-bold" : "text-muted-foreground")}>
              {d.period.slice(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
