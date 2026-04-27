/** Daily Sales Detail — read-only view + Validate/Reject (finance) buttons + Edit (outlet). */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Edit2, CheckCircle2, XCircle, FileText } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/format";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function DailySalesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [ds, setDs] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([
        api.get(`/outlet/daily-sales/${id}`),
        api.get("/master/outlets", { params: { per_page: 100 } }),
      ]);
      setDs(unwrap(r));
      setOutlets(unwrap(o) || []);
    } catch (e) {
      toast.error("Gagal load detail");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (loading || !ds) return <LoadingState rows={8} />;
  const outletName = outlets.find(o => o.id === ds.outlet_id)?.name || ds.outlet_id;

  async function validate() {
    if (!confirm("Validate daily sales? Jurnal akan dibuat.")) return;
    try {
      await api.post(`/outlet/daily-sales/${id}/validate`);
      toast.success("Validated. Jurnal dibuat.");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal validate");
    }
  }

  async function rejectSubmit() {
    if (!reason.trim()) { toast.error("Alasan wajib"); return; }
    try {
      await api.post(`/outlet/daily-sales/${id}/reject`, { reason });
      toast.success("Daily sales di-reject");
      setReject(false); setReason("");
      load();
    } catch (e) {
      toast.error("Gagal reject");
    }
  }

  const canValidate = can("finance.sales.validate") && ds.status === "submitted";
  const canReject = can("finance.sales.request_fix") && ds.status === "submitted";
  const canEdit = (ds.status === "draft" || ds.status === "rejected") && can("outlet.daily_sales.create");

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">Daily Sales {fmtDate(ds.sales_date)}</h2>
        <StatusPill status={ds.status} />
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <Link to={`/outlet/daily-sales/${id}/edit`}>
              <Button variant="outline" className="rounded-full gap-2" data-testid="ds-edit">
                <Edit2 className="h-4 w-4" /> Edit
              </Button>
            </Link>
          )}
          {canReject && (
            <Button onClick={() => setReject(true)} variant="outline" className="rounded-full gap-2 text-red-600 hover:bg-red-500/10" data-testid="ds-reject">
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          )}
          {canValidate && (
            <Button onClick={validate} className="rounded-full pill-active gap-2" data-testid="ds-validate">
              <CheckCircle2 className="h-4 w-4" /> Validate
            </Button>
          )}
        </div>
      </div>

      {ds.status === "rejected" && ds.rejected_reason && (
        <div className="glass-card border-l-4 border-red-500 p-4 text-sm">
          <strong className="text-red-700 dark:text-red-400">Rejected:</strong> {ds.rejected_reason}
        </div>
      )}
      {ds.journal_entry_id && (
        <div className="glass-card border-l-4 border-emerald-500 p-3 text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span>Journal Entry ID: <code className="text-xs">{ds.journal_entry_id}</code></span>
        </div>
      )}

      <div className="glass-card p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Field label="Outlet" value={outletName} />
        <Field label="Tanggal" value={fmtDate(ds.sales_date)} />
        <Field label="Trx Count" value={ds.transaction_count || 0} />
        <Field label="Submitted" value={ds.submitted_at ? fmtDateTime(ds.submitted_at) : "-"} />
      </div>

      <div className="glass-card p-5">
        <h3 className="font-semibold mb-3">Channels</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b border-border/50">
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Channel</th>
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Gross</th>
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Discount</th>
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Net</th>
          </tr></thead>
          <tbody>
            {(ds.channels || []).map(c => (
              <tr key={c.channel} className="border-b border-border/30">
                <td className="px-3 py-2 capitalize">{c.channel}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRp(c.gross || 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRp(c.discount || 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtRp(c.net || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3">Revenue Buckets</h3>
          <div className="space-y-2 text-sm">
            {(ds.revenue_buckets || []).map(b => (
              <div key={b.bucket} className="flex justify-between">
                <span className="capitalize text-muted-foreground">{b.bucket}</span>
                <span className="tabular-nums font-medium">{fmtRp(b.amount || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Service Charge</span>
              <span className="tabular-nums">{fmtRp(ds.service_charge || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{fmtRp(ds.tax_amount || 0)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border/50 text-base font-bold">
              <span>Grand Total</span>
              <span className="tabular-nums">{fmtRp(ds.grand_total || 0)}</span>
            </div>
          </div>
        </div>
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3">Payment Breakdown</h3>
          {(ds.payment_breakdown || []).length === 0 && <div className="text-sm text-muted-foreground">—</div>}
          <div className="space-y-2 text-sm">
            {(ds.payment_breakdown || []).map((p, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">{p.payment_method_name || p.payment_method_id}</span>
                <span className="tabular-nums font-medium">{fmtRp(p.amount || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {ds.notes && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-1 text-sm">Catatan</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{ds.notes}</p>
        </div>
      )}

      <Dialog open={reject} onOpenChange={setReject}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Daily Sales?</DialogTitle>
            <DialogDescription>Sertakan alasan agar outlet manager bisa memperbaiki.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Mis: Total pembayaran tidak cocok dengan grand total…" className="glass-input min-h-[100px]" data-testid="ds-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(false)}>Batal</Button>
            <Button onClick={rejectSubmit} className="pill-active" data-testid="ds-reject-confirm">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
