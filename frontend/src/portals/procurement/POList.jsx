/** PO List + filter. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileCheck, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_TABS = [
  { key: "",          label: "Semua" },
  { key: "draft",     label: "Draft" },
  { key: "sent",      label: "Sent" },
  { key: "partial",   label: "Partial" },
  { key: "received",  label: "Received" },
  { key: "cancelled", label: "Cancelled" },
];

export default function POList() {
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });

  useEffect(() => {
    api.get("/master/vendors", { params: { per_page: 200 } })
      .then(r => setVendors(unwrap(r) || [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (status) params.status = status;
      if (vendorId) params.vendor_id = vendorId;
      const res = await api.get("/procurement/pos", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load PO");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, status, vendorId]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[220px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Vendor</Label>
          <select value={vendorId} onChange={e => { setVendorId(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="po-filter-vendor">
            <option value="">Semua</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <Link to="/procurement/po/new" className="ml-auto">
          <Button className="rounded-full pill-active gap-2 h-10" data-testid="po-new">
            <Plus className="h-4 w-4" /> PO Baru
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
            data-testid={`po-tab-${t.key || "all"}`}
          >{t.label}</button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Doc No</Th><Th>Tanggal</Th><Th>Vendor</Th>
              <Th className="text-right">Lines</Th>
              <Th className="text-right">Grand Total</Th>
              <Th>Status</Th><Th></Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-6"><LoadingState rows={5} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7}>
                  <EmptyState icon={FileCheck} title="Belum ada PO"
                    description="Buat PO dari PR yang sudah approved atau langsung."
                    action={<Link to="/procurement/po/new"><Button className="pill-active rounded-full">Buat PO</Button></Link>}
                  />
                </td></tr>
              )}
              {!loading && items.map(po => {
                const v = vendors.find(x => x.id === po.vendor_id);
                return (
                  <tr key={po.id} className="border-b border-border/30 hover:bg-foreground/5">
                    <td className="px-5 py-3 font-mono text-xs">{po.doc_no || po.id.slice(0, 8)}</td>
                    <td className="px-5 py-3">{fmtDate(po.order_date)}</td>
                    <td className="px-5 py-3">{v?.name || po.vendor_id}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{po.lines?.length || 0}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmtRp(po.grand_total || 0)}</td>
                    <td className="px-5 py-3"><StatusPill status={po.status} /></td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/procurement/po/${po.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid={`po-view-${po.id}`}>
                        <Eye className="h-3.5 w-3.5" /> Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
