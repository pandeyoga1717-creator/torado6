/** Inventory valuation snapshot per outlet. */
import { useEffect, useState } from "react";
import api, { unwrap } from "@/lib/api";
import { Label } from "@/components/ui/label";
import KpiCard from "@/components/shared/KpiCard";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtDateTime } from "@/lib/format";
import { BarChart3, Layers, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function Valuation() {
  const [val, setVal] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then(r => setOutlets(unwrap(r) || [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/inventory/valuation", { params });
      setVal(unwrap(res));
    } catch (e) {
      toast.error("Gagal load valuation");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [outletId]); // eslint-disable-line

  if (loading) return <LoadingState rows={4} />;

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[220px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <select value={outletId} onChange={e => setOutletId(e.target.value)}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="val-outlet">
            <option value="">Semua (consolidated)</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="text-xs text-muted-foreground">As of: {val?.as_of ? fmtDateTime(val.as_of) : "—"}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard label="Total Inventory Value" value={fmtRp(val?.total_value || 0)} icon={BarChart3} color="aurora-1" />
        <KpiCard label="Item Count (qty>0)" value={val?.item_count || 0} icon={Layers} color="aurora-2" />
        <KpiCard label="Outlet" value={Object.keys(val?.by_outlet || {}).length} icon={Building2} color="aurora-4" />
      </div>

      <div className="glass-card p-5">
        <h3 className="font-semibold mb-3">Per Outlet</h3>
        {(!val?.by_outlet || Object.keys(val.by_outlet).length === 0) ? (
          <EmptyState title="Belum ada nilai inventory" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(val.by_outlet).map(([oid, value]) => {
              const o = outlets.find(x => x.id === oid);
              const pct = val.total_value > 0 ? (value / val.total_value) * 100 : 0;
              return (
                <div key={oid} className="glass-input rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{o?.name || oid}</span>
                    <span className="font-bold tabular-nums">{fmtRp(value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                    <div className="h-full grad-aurora" style={{ width: `${pct.toFixed(1)}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">{pct.toFixed(1)}% dari total</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
