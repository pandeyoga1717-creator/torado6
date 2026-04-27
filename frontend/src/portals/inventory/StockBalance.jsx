/** Stock Balance — list aggregated per item per outlet. */
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtNumber } from "@/lib/format";
import { toast } from "sonner";

export default function StockBalance() {
  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [outletId, setOutletId] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 100 });

  const outletMap = useMemo(
    () => Object.fromEntries(outlets.map(o => [o.id, o])),
    [outlets],
  );

  useEffect(() => {
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then(r => setOutlets(unwrap(r) || [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 100 };
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/inventory/balance", { params });
      setRows(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load stock");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, outletId]); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(r =>
      (r.item_name || "").toLowerCase().includes(s) ||
      (r.item_id || "").toLowerCase().includes(s),
    );
  }, [q, rows]);

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <select value={outletId} onChange={e => { setOutletId(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="inv-bal-outlet">
            <option value="">Semua</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Cari Item</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama item…" className="glass-input pl-9 h-9" data-testid="inv-bal-search" />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Item</Th><Th>Outlet</Th>
              <Th className="text-right">Qty</Th>
              <Th>Unit</Th>
              <Th className="text-right">Last Cost</Th>
              <Th className="text-right">Total Value</Th>
              <Th>Last Move</Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-6"><LoadingState rows={6} /></td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7}><EmptyState title="Belum ada stok" description="Posting GR atau adjustment untuk menambah stok." /></td></tr>
              )}
              {!loading && filtered.map((r, i) => (
                <tr key={`${r.item_id}-${r.outlet_id}-${i}`} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3 font-medium">{r.item_name || r.item_id}</td>
                  <td className="px-5 py-3">{outletMap[r.outlet_id]?.name || r.outlet_id}</td>
                  <td className={`px-5 py-3 text-right tabular-nums font-semibold ${r.qty < 0 ? "text-red-700 dark:text-red-400" : ""}`}>
                    {fmtNumber(r.qty, 2)}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{r.unit || "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtRp(r.last_unit_cost || 0)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtRp(r.total_value || 0)}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{r.last_movement_at || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
