/** PO Detail — view + multi-tier approve + send/cancel + create GR shortcut. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Ban, Truck, FileCheck, CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import ApprovalChain from "@/components/shared/ApprovalChain";
import ApprovalProgress from "@/components/shared/ApprovalProgress";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function PODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [po, setPo] = useState(null);
  const [state, setState] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [list, v, o, st] = await Promise.all([
        api.get("/procurement/pos", { params: { per_page: 100 } }),
        api.get("/master/vendors", { params: { per_page: 200 } }),
        api.get("/master/outlets", { params: { per_page: 100 } }),
        api.get(`/procurement/pos/${id}/approval-state`).catch(() => null),
      ]);
      setVendors(unwrap(v) || []);
      setOutlets(unwrap(o) || []);
      const found = (unwrap(list) || []).find(x => x.id === id);
      setPo(found || null);
      setState(st ? unwrap(st) : null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function send() {
    if (!confirm("Kirim PO ke vendor?")) return;
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/send`);
      toast.success("PO dikirim"); load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal kirim");
    } finally { setActing(false); }
  }
  async function cancel() {
    if (!reason.trim()) { toast.error("Alasan wajib"); return; }
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/cancel`, { reason });
      toast.success("PO dibatalkan");
      setCancelOpen(false); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal cancel");
    } finally { setActing(false); }
  }
  async function submitForApproval() {
    if (!confirm("Kirim PO untuk approval?")) return;
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/submit`);
      toast.success("PO dikirim untuk approval"); load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal submit");
    } finally { setActing(false); }
  }
  async function approve() {
    if (!confirm("Approve PO ini?")) return;
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/approve`, { note: "Approved" });
      toast.success("PO approved"); load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal approve");
    } finally { setActing(false); }
  }
  async function rejectSubmit() {
    if (!reason.trim()) { toast.error("Alasan wajib"); return; }
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/reject`, { reason });
      toast.success("PO rejected");
      setRejectOpen(false); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal reject");
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!po) return <div className="glass-card p-6 text-center">PO tidak ditemukan</div>;

  const vendorName = vendors.find(v => v.id === po.vendor_id)?.name || po.vendor_id;
  const outletName = po.outlet_id ? (outlets.find(o => o.id === po.outlet_id)?.name || po.outlet_id) : "Central";
  const hasWf = !!state?.has_workflow;
  const wfNeedsApproval = hasWf && !state.is_complete && !state.is_rejected;

  let canApproveNow = false;
  if (wfNeedsApproval) {
    const required = state.steps?.[state.current_step_idx]?.any_of_perms || [];
    canApproveNow = required.some(p => can(p)) || can("*");
  }

  // PO must be in awaiting_approval to be approved
  const isAwaitingApproval = po.status === "awaiting_approval";
  // From draft → submit (move to awaiting_approval) only if workflow exists
  const canSubmitForApproval = hasWf && po.status === "draft" && can("procurement.po.create");
  const canSendDirectly = !hasWf && po.status === "draft" && can("procurement.po.send");
  // Send (after approval complete OR no workflow at all)
  const canSendApproved = can("procurement.po.send") && (
    po.status === "approved" || (!hasWf && po.status === "draft")
  );
  const canCancel = can("procurement.po.cancel") && ["draft", "awaiting_approval", "approved", "sent", "partial"].includes(po.status);
  const canReceive = can("procurement.gr.post") && ["sent", "partial"].includes(po.status);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">PO {po.doc_no || po.id.slice(0, 8)}</h2>
        <StatusPill status={po.status} />
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {canCancel && (
            <Button onClick={() => { setCancelOpen(true); setReason(""); }}
              variant="outline" className="rounded-full gap-2 text-red-600" disabled={acting} data-testid="po-cancel">
              <Ban className="h-4 w-4" /> Cancel
            </Button>
          )}
          {wfNeedsApproval && isAwaitingApproval && canApproveNow && (
            <>
              <Button onClick={() => { setRejectOpen(true); setReason(""); }}
                variant="outline" disabled={acting} className="rounded-full gap-2 text-red-600" data-testid="po-reject">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button onClick={approve} disabled={acting} className="rounded-full pill-active gap-2" data-testid="po-approve">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            </>
          )}
          {canSubmitForApproval && (
            <Button onClick={submitForApproval} disabled={acting} className="rounded-full pill-active gap-2" data-testid="po-submit">
              <ClipboardCheck className="h-4 w-4" /> Submit for Approval
            </Button>
          )}
          {(canSendApproved || canSendDirectly) && (
            <Button onClick={send} disabled={acting} className="rounded-full pill-active gap-2" data-testid="po-send">
              <Send className="h-4 w-4" /> Kirim ke Vendor
            </Button>
          )}
          {canReceive && (
            <Link to={`/procurement/gr/new?po=${po.id}`}>
              <Button className="rounded-full pill-active gap-2" data-testid="po-receive">
                <Truck className="h-4 w-4" /> Terima Barang (GR)
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Field label="Vendor" value={vendorName} />
        <Field label="Delivery To" value={outletName} />
        <Field label="Order Date" value={fmtDate(po.order_date)} />
        <Field label="Expected Delivery" value={po.expected_delivery_date ? fmtDate(po.expected_delivery_date) : "—"} />
        <Field label="Payment Terms" value={`${po.payment_terms_days} hari`} />
        {po.sent_at && <Field label="Sent At" value={fmtDate(po.sent_at)} />}
      </div>

      {hasWf && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3">Approval Progress</h3>
          <ApprovalProgress state={state} />
          {wfNeedsApproval && (
            <p className="text-xs text-muted-foreground mt-3">
              Tahap saat ini: <b>{state.steps[state.current_step_idx]?.label}</b>.
              {canApproveNow && isAwaitingApproval ? " Anda berwenang approve di tahap ini." :
                isAwaitingApproval ? " Tunggu approver yang berwenang." :
                po.status === "draft" ? " PO masih draft. Klik 'Submit for Approval'." : ""}
            </p>
          )}
        </div>
      )}

      <div className="glass-card p-5">
        <h3 className="font-semibold mb-3">Line Items</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b border-border/50">
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Item</th>
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Qty</th>
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Unit</th>
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Unit Cost</th>
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Total</th>
          </tr></thead>
          <tbody>
            {(po.lines || []).map((ln, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="px-3 py-2 font-medium">{ln.item_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{ln.qty}</td>
                <td className="px-3 py-2 text-muted-foreground">{ln.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRp(ln.unit_cost || 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtRp(ln.total || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 max-w-sm ml-auto space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmtRp(po.subtotal || 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{fmtRp(po.tax_total || 0)}</span></div>
          <div className="flex justify-between pt-2 border-t border-border/50 text-base font-bold"><span>Grand Total</span><span className="tabular-nums">{fmtRp(po.grand_total || 0)}</span></div>
        </div>
      </div>

      {po.cancelled_reason && (
        <div className="glass-card p-4 text-sm border-l-4 border-red-500">
          <strong className="text-red-700 dark:text-red-400">Cancelled:</strong> {po.cancelled_reason}
        </div>
      )}
      {po.rejected_reason && (
        <div className="glass-card p-4 text-sm border-l-4 border-red-500">
          <strong className="text-red-700 dark:text-red-400">Rejected:</strong> {po.rejected_reason}
        </div>
      )}

      {(po.approval_chain || []).length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3">Approval Timeline</h3>
          <ApprovalChain chain={po.approval_chain || []} />
        </div>
      )}

      {po.notes && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-1">Catatan</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{po.notes}</p>
        </div>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel PO?</DialogTitle>
            <DialogDescription>Berikan alasan pembatalan.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} className="glass-input min-h-[100px]" placeholder="Alasan…" data-testid="po-cancel-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Batal</Button>
            <Button onClick={cancel} className="pill-active" data-testid="po-cancel-confirm">Cancel PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Reject PO?</DialogTitle>
            <DialogDescription>Berikan alasan reject pada step ini.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} className="glass-input min-h-[100px]" placeholder="Alasan…" data-testid="po-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Batal</Button>
            <Button onClick={rejectSubmit} className="pill-active" data-testid="po-reject-confirm">Reject</Button>
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
