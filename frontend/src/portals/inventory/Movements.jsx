/** Movements — history list with filters. */
import { useEffect, useMemo, useState } from "react";
import api, { unwrap } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtNumber, fmtDate } from "@/lib/format";
import { toast } from "sonner";

const TYPE_OPTIONS = [
  { v: "",            l: "Semua" },
  { v: "receipt",     l: "Receipt" },
  { v: "transfer_in", l: "Transfer In" },
  { v: "transfer_out",l: "Transfer Out" },
  { v: "adjustment",  l: "Adjustment" },
  { v: "opname_diff", l: "Opname Diff" },
  { v: "issue",       l: "Issue" },
];

export default function Movements() {
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [outletId, setOutletId] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 50 });

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
      const params = { page, per_page: 50 };
      if (outletId) params.outlet_id = outletId;
      if (type) params.movement_type = type;
      if (dateFrom) params.date_from = dateFrom;
      const res = await api.get("/inventory/movements", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load movements");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, outletId, type, dateFrom]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 50)));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[180px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <select value={outletId} onChange={e => { setOutletId(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1">
            <option value="">Semua</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Type</Label>
          <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1">
            {TYPE_OPTIONS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Sejak Tanggal</Label>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="glass-input mt-1 h-9" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Tanggal</Th><Th>Outlet</Th><Th>Item</Th><Th>Type</Th>
              <Th className="text-right">Qty</Th><Th className="text-right">Unit Cost</Th>
              <Th className="text-right">Total Cost</Th><Th>Ref</Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="p-6"><LoadingState rows={8} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8}><EmptyState title="Belum ada movement" /></td></tr>
              )}
              {!loading && items.map(m => (
                <tr key={m.id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3">{fmtDate(m.movement_date)}</td>
                  <td className="px-5 py-3">{outletMap[m.outlet_id]?.name || m.outlet_id}</td>
                  <td className="px-5 py-3 font-medium">{m.item_name || m.item_id}</td>
                  <td className="px-5 py-3 capitalize">{m.movement_type.replace("_", " ")}</td>
                  <td className={`px-5 py-3 text-right tabular-nums font-semibold ${m.qty > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {m.qty > 0 ? "+" : ""}{fmtNumber(m.qty, 2)} {m.unit}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtRp(m.unit_cost || 0)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtRp(m.total_cost || 0)}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground capitalize">{m.ref_type || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
