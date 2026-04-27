/** Daily Sales — list view with filter (status, date range, outlet). */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Calendar, Filter, Receipt, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const STATUS_TABS = [
  { key: "",          label: "Semua" },
  { key: "draft",     label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "validated", label: "Validated" },
  { key: "rejected",  label: "Rejected" },
];

export default function DailySalesList() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [outletId, setOutletId] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });

  const outletMap = useMemo(
    () => Object.fromEntries(outlets.map(o => [o.id, o])),
    [outlets],
  );

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (status) params.status = status;
      if (outletId) params.outlet_id = outletId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get("/outlet/daily-sales", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load daily sales");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then(r => setOutlets(unwrap(r) || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, status, outletId, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[160px]">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            <Calendar className="inline h-3 w-3 mr-1" /> Dari Tanggal
          </label>
          <Input
            type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="glass-input mt-1 h-9" data-testid="ds-filter-date-from"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            <Calendar className="inline h-3 w-3 mr-1" /> Sampai Tanggal
          </label>
          <Input
            type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="glass-input mt-1 h-9" data-testid="ds-filter-date-to"
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            <Filter className="inline h-3 w-3 mr-1" /> Outlet
          </label>
          <select
            value={outletId}
            onChange={e => { setOutletId(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            data-testid="ds-filter-outlet"
          >
            <option value="">Semua outlet</option>
            {outlets.filter(o => !user.outlet_ids?.length || user.outlet_ids.includes(o.id) || (user.permissions || []).includes("*"))
              .map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
          </select>
        </div>
        <Link to="/outlet/daily-sales/new" className="ml-auto">
          <Button className="rounded-full pill-active gap-2 h-10 px-4" data-testid="ds-new">
            <Plus className="h-4 w-4" /> Daily Sales Baru
          </Button>
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => (
          <button
            key={t.key || "all"}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
              status === t.key ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground"
            }`}
            data-testid={`ds-tab-${t.key || "all"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border/50">
                <Th>Tanggal</Th>
                <Th>Outlet</Th>
                <Th className="text-right">Grand Total</Th>
                <Th className="text-right">Trx</Th>
                <Th>Status</Th>
                <Th className="text-right"></Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="p-6"><LoadingState rows={6} /></td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState
                    icon={Receipt}
                    title="Belum ada daily sales"
                    description="Buat draft daily sales untuk hari ini."
                    action={
                      <Link to="/outlet/daily-sales/new">
                        <Button className="pill-active rounded-full">Buat Daily Sales</Button>
                      </Link>
                    }
                  />
                </td></tr>
              )}
              {!loading && items.map((s) => (
                <tr key={s.id} className="border-b border-border/30 hover:bg-foreground/5 transition-colors">
                  <td className="px-5 py-3 font-medium">{fmtDate(s.sales_date)}</td>
                  <td className="px-5 py-3">{outletMap[s.outlet_id]?.name || s.outlet_id}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmtRp(s.grand_total || 0)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{s.transaction_count || 0}</td>
                  <td className="px-5 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/outlet/daily-sales/${s.id}`}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      data-testid={`ds-view-${s.id}`}
                    >
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
  return (
    <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}
