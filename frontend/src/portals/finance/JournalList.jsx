/** Journal List with filters: period, source_type, search, COA, dim_outlet. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BookOpenCheck, Search, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";

const SOURCE_TYPES = [
  { v: "",                l: "Semua sumber" },
  { v: "sales",           l: "Daily Sales" },
  { v: "petty_cash",      l: "Petty Cash" },
  { v: "urgent_purchase", l: "Urgent Purchase" },
  { v: "goods_receipt",   l: "Goods Receipt" },
  { v: "adjustment",      l: "Stock Adjustment" },
  { v: "opname",          l: "Opname Variance" },
  { v: "manual",          l: "Manual JE" },
  { v: "reversal",        l: "Reversal" },
];

export default function JournalList() {
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => todayJakartaISO().slice(0, 7));
  const [sourceType, setSourceType] = useState("");
  const [outletId, setOutletId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });

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
      const params = { page, per_page: 20 };
      if (period) params.period = period;
      if (sourceType) params.source_type = sourceType;
      if (outletId) params.dim_outlet = outletId;
      if (search) params.search = search;
      const res = await api.get("/finance/journals", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load journals");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, period, sourceType, outletId, search]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Period</Label>
          <Input type="month" value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }}
            className="glass-input mt-1 h-9" data-testid="je-period" />
        </div>
        <div className="min-w-[180px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Source</Label>
          <select value={sourceType} onChange={e => { setSourceType(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="je-source">
            {SOURCE_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div className="min-w-[180px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet (dim)</Label>
          <select value={outletId} onChange={e => { setOutletId(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1">
            <option value="">Semua</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Cari</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Doc no / deskripsi…" className="glass-input pl-9 h-9" data-testid="je-search" />
          </div>
        </div>
        <Link to="/finance/manual-journal">
          <Button className="rounded-full pill-active gap-2 h-10" data-testid="je-new">
            <Plus className="h-4 w-4" /> Manual JE
          </Button>
        </Link>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Doc No</Th><Th>Tanggal</Th><Th>Source</Th>
              <Th>Deskripsi</Th>
              <Th className="text-right">Total Dr</Th>
              <Th>Status</Th><Th></Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-6"><LoadingState rows={6} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon={BookOpenCheck} title="Tidak ada journal entry" description="Coba ubah filter atau buat manual JE." /></td></tr>
              )}
              {!loading && items.map(je => (
                <tr key={je.id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3 font-mono text-xs">{je.doc_no || je.id.slice(0, 8)}</td>
                  <td className="px-5 py-3">{fmtDate(je.entry_date)}</td>
                  <td className="px-5 py-3 capitalize">{(je.source_type || "").replace("_", " ")}</td>
                  <td className="px-5 py-3 max-w-[280px] truncate">{je.description}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmtRp(je.total_dr || 0)}</td>
                  <td className="px-5 py-3"><StatusPill status={je.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/finance/journals/${je.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid={`je-view-${je.id}`}>
                      <Eye className="h-3.5 w-3.5" /> Detail
                    </Link>
                  </td>
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
