/** GR (Goods Receipt) List + create. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, PackageOpen, FileText } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export default function GRList() {
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });

  useEffect(() => {
    Promise.all([
      api.get("/master/vendors", { params: { per_page: 200 } }),
      api.get("/master/outlets", { params: { per_page: 100 } }),
    ]).then(([v, o]) => {
      setVendors(unwrap(v) || []);
      setOutlets(unwrap(o) || []);
    }).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/procurement/grs", { params: { page, per_page: 20 } });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load GR");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Goods Receipts</h3>
          <p className="text-xs text-muted-foreground">Posting GR akan otomatis menambah stok &amp; jurnal AP.</p>
        </div>
        <Link to="/procurement/gr/new">
          <Button className="rounded-full pill-active gap-2 h-10" data-testid="gr-new">
            <Plus className="h-4 w-4" /> Posting GR
          </Button>
        </Link>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Doc No</Th><Th>Tanggal</Th><Th>Vendor</Th><Th>Outlet</Th>
              <Th>Invoice</Th>
              <Th className="text-right">Grand Total</Th>
              <Th>Status</Th><Th></Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="p-6"><LoadingState rows={5} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState icon={PackageOpen} title="Belum ada GR"
                    description="Posting GR setelah barang diterima dari vendor."
                    action={<Link to="/procurement/gr/new"><Button className="pill-active rounded-full">Posting GR</Button></Link>}
                  />
                </td></tr>
              )}
              {!loading && items.map(gr => {
                const v = vendors.find(x => x.id === gr.vendor_id);
                const o = outlets.find(x => x.id === gr.outlet_id);
                return (
                  <tr key={gr.id} className="border-b border-border/30 hover:bg-foreground/5">
                    <td className="px-5 py-3 font-mono text-xs">{gr.doc_no || gr.id.slice(0, 8)}</td>
                    <td className="px-5 py-3">{fmtDate(gr.receive_date)}</td>
                    <td className="px-5 py-3">{v?.name || gr.vendor_id}</td>
                    <td className="px-5 py-3">{o?.name || gr.outlet_id}</td>
                    <td className="px-5 py-3 text-xs">{gr.invoice_no || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmtRp(gr.grand_total || 0)}</td>
                    <td className="px-5 py-3"><StatusPill status={gr.status} /></td>
                    <td className="px-5 py-3">
                      {gr.journal_entry_id && (
                        <span className="text-[11px] flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <FileText className="h-3 w-3" /> JE
                        </span>
                      )}
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
