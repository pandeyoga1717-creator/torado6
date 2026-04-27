/** Purchase Request List + filter. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_TABS = [
  { key: "",          label: "Semua" },
  { key: "draft",     label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved",  label: "Approved" },
  { key: "rejected",  label: "Rejected" },
  { key: "converted", label: "Converted" },
];

export default function PRList() {
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [outletId, setOutletId] = useState("");
  const [source, setSource] = useState("");
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
      if (status) params.status = status;
      if (outletId) params.outlet_id = outletId;
      if (source) params.source = source;
      const res = await api.get("/procurement/prs", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load PR");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, status, outletId, source]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[180px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <select value={outletId} onChange={e => { setOutletId(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="pr-filter-outlet">
            <option value="">Semua</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="min-w-[150px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Source</Label>
          <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1">
            <option value="">Semua</option>
            <option value="manual">Manual</option>
            <option value="KDO">KDO</option>
            <option value="BDO">BDO</option>
          </select>
        </div>
        <Link to="/procurement/pr/new" className="ml-auto">
          <Button className="rounded-full pill-active gap-2 h-10" data-testid="pr-new">
            <Plus className="h-4 w-4" /> PR Baru
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => (
          <button key={t.key || "all"}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
              status === t.key ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground"
            }`}
            data-testid={`pr-tab-${t.key || "all"}`}
          >{t.label}</button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Doc No</Th><Th>Tanggal</Th><Th>Outlet</Th>
              <Th>Source</Th><Th className="text-right">Lines</Th><Th>Status</Th><Th></Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-6"><LoadingState rows={5} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7}>
                  <EmptyState icon={FileText} title="Belum ada PR"
                    description="Buat PR untuk request item dari outlet/central."
                    action={<Link to="/procurement/pr/new"><Button className="pill-active rounded-full">Buat PR</Button></Link>}
                  />
                </td></tr>
              )}
              {!loading && items.map(pr => (
                <tr key={pr.id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3 font-mono text-xs">{pr.doc_no || pr.id.slice(0, 8)}</td>
                  <td className="px-5 py-3">{fmtDate(pr.request_date)}</td>
                  <td className="px-5 py-3">{outletMap[pr.outlet_id]?.name || pr.outlet_id}</td>
                  <td className="px-5 py-3">{pr.source}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{pr.lines?.length || 0}</td>
                  <td className="px-5 py-3"><StatusPill status={pr.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/procurement/pr/${pr.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid={`pr-view-${pr.id}`}>
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
