/** Sales Validation Queue — Finance approves submitted DS → generates JE. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, CheckCircle2, XCircle, Eye, Clock } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtDate, fmtRelative } from "@/lib/format";
import { toast } from "sonner";

export default function ValidationQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 50 });
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/validation-queue", { params: { page, per_page: 50 } });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load validation queue");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);

  async function validate(ds) {
    if (!confirm(`Validate daily sales ${fmtDate(ds.sales_date)} di ${ds.outlet_name}? Jurnal akan dibuat.`)) return;
    try {
      await api.post(`/outlet/daily-sales/${ds.id}/validate`);
      toast.success("Validated. Jurnal dibuat.");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal validate");
    }
  }

  async function rejectSubmit() {
    if (!reason.trim()) { toast.error("Alasan wajib"); return; }
    try {
      await api.post(`/outlet/daily-sales/${reject.id}/reject`, { reason });
      toast.success("Rejected. Outlet manager akan diberi tahu.");
      setReject(null); setReason("");
      load();
    } catch (e) { toast.error("Gagal reject"); }
  }

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 50)));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Sales Validation Queue</h3>
          <p className="text-xs text-muted-foreground">
            Daily sales yang submitted dari outlet. Validate untuk meng-generate jurnal.
          </p>
        </div>
        <div className="text-sm font-semibold tabular-nums">
          {meta.total} pending
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Tanggal</Th>
              <Th>Outlet</Th>
              <Th className="text-right">Grand Total</Th>
              <Th className="text-right">Trx</Th>
              <Th>Submitted</Th>
              <Th></Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-6"><LoadingState rows={5} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState icon={ClipboardCheck} title="Inbox kosong"
                    description="Tidak ada daily sales yang menunggu validasi." />
                </td></tr>
              )}
              {!loading && items.map(ds => (
                <tr key={ds.id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3 font-medium">{fmtDate(ds.sales_date)}</td>
                  <td className="px-5 py-3">{ds.outlet_name}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmtRp(ds.grand_total || 0)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{ds.transaction_count || 0}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {ds.submitted_at ? fmtRelative(ds.submitted_at) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Link to={`/outlet/daily-sales/${ds.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-full glass-input" data-testid={`fin-vq-view-${ds.id}`}>
                        <Eye className="h-3 w-3" /> Detail
                      </Link>
                      <Button onClick={() => setReject(ds)} size="sm" variant="outline" className="rounded-full gap-1 h-7 px-3 text-red-600 hover:bg-red-500/10" data-testid={`fin-vq-reject-${ds.id}`}>
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                      <Button onClick={() => validate(ds)} size="sm" className="rounded-full pill-active gap-1 h-7 px-3" data-testid={`fin-vq-validate-${ds.id}`}>
                        <CheckCircle2 className="h-3 w-3" /> Validate
                      </Button>
                    </div>
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

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Daily Sales?</DialogTitle>
            <DialogDescription>
              {reject ? `${fmtDate(reject.sales_date)} · ${reject.outlet_name} · ${fmtRp(reject.grand_total || 0)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan reject (mis: total pembayaran tidak balance)" className="glass-input min-h-[100px]" data-testid="fin-vq-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>Batal</Button>
            <Button onClick={rejectSubmit} className="pill-active" data-testid="fin-vq-reject-confirm">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
