/** PR Detail — view + multi-tier approve/reject + ApprovalChain + ApprovalProgress. */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
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

export default function PRDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [pr, setPr] = useState(null);
  const [state, setState] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [list, o, st] = await Promise.all([
        api.get("/procurement/prs", { params: { per_page: 50 } }),
        api.get("/master/outlets", { params: { per_page: 100 } }),
        api.get(`/procurement/prs/${id}/approval-state`).catch(() => null),
      ]);
      setOutlets(unwrap(o) || []);
      const found = (unwrap(list) || []).find(x => x.id === id);
      setPr(found || null);
      setState(st ? unwrap(st) : null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function approve() {
    if (!confirm("Approve PR ini?")) return;
    try {
      setActing(true);
      await api.post(`/procurement/prs/${id}/approve`, { note: "Approved" });
      toast.success("PR approved");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal approve");
    } finally { setActing(false); }
  }
  async function rejectSubmit() {
    if (!reason.trim()) { toast.error("Alasan wajib"); return; }
    try {
      setActing(true);
      await api.post(`/procurement/prs/${id}/reject`, { reason });
      toast.success("PR rejected");
      setReject(false); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal reject");
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!pr) return <div className="glass-card p-6 text-center">PR tidak ditemukan</div>;

  const outletName = outlets.find(o => o.id === pr.outlet_id)?.name || pr.outlet_id;
  const totalEst = (pr.lines || []).reduce(
    (s, ln) => s + Number(ln.qty || 0) * Number(ln.est_cost || 0), 0,
  );

  // Engine-aware eligibility:
  // - User can approve only if they hold ANY of current step's required perms (or *)
  // - If no workflow → fall back to legacy permission check (procurement.pr.approve)
  let canApproveNow = false;
  let canRejectNow = false;
  if (state?.has_workflow && !state.is_complete && !state.is_rejected) {
    const required = state.steps?.[state.current_step_idx]?.any_of_perms || [];
    canApproveNow = required.some(p => can(p)) || can("*");
    canRejectNow = canApproveNow; // same gate to reject at this step
  } else if (!state?.has_workflow) {
    canApproveNow = can("procurement.pr.approve") && pr.status === "submitted";
    canRejectNow = can("procurement.pr.reject") && pr.status === "submitted";
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">PR {pr.doc_no || pr.id.slice(0, 8)}</h2>
        <StatusPill status={pr.status} />
        <div className="ml-auto flex items-center gap-2">
          {canRejectNow && (
            <Button onClick={() => setReject(true)} disabled={acting}
              variant="outline" className="rounded-full gap-2 text-red-600" data-testid="pr-reject">
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          )}
          {canApproveNow && (
            <Button onClick={approve} disabled={acting}
              className="rounded-full pill-active gap-2" data-testid="pr-approve">
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          )}
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Field label="Outlet" value={outletName} />
        <Field label="Tanggal Request" value={fmtDate(pr.request_date)} />
        <Field label="Needed By" value={pr.needed_by ? fmtDate(pr.needed_by) : "—"} />
        <Field label="Source" value={pr.source} />
      </div>

      {state?.has_workflow && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3">Approval Progress</h3>
          <ApprovalProgress state={state} />
          {state.is_complete === false && state.current_step_idx != null && (
            <p className="text-xs text-muted-foreground mt-3">
              Tahap saat ini: <b>{state.steps[state.current_step_idx]?.label}</b>.
              {canApproveNow ? " Anda berwenang approve di tahap ini." : " Tunggu approver yang berwenang."}
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
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Est. Cost</th>
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Subtotal</th>
            <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Notes</th>
          </tr></thead>
          <tbody>
            {(pr.lines || []).map((ln, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="px-3 py-2 font-medium">{ln.item_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{ln.qty}</td>
                <td className="px-3 py-2 text-muted-foreground">{ln.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRp(ln.est_cost || 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtRp(Number(ln.qty || 0) * Number(ln.est_cost || 0))}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{ln.notes || "—"}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={4} className="px-3 py-3 text-right">Total Estimasi</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtRp(totalEst)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3">Approval Timeline</h3>
          <ApprovalChain chain={pr.approval_chain || []} />
        </div>
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-2">Catatan</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{pr.notes || "—"}</p>
          {pr.rejected_reason && (
            <div className="mt-3 text-sm border-l-4 border-red-500 pl-3">
              <strong className="text-red-700 dark:text-red-400">Rejected:</strong> {pr.rejected_reason}
            </div>
          )}
          {pr.converted_to_po_ids?.length > 0 && (
            <div className="mt-3 text-sm">
              <strong>Converted to PO:</strong>
              <ul className="list-disc list-inside mt-1 text-xs text-muted-foreground">
                {pr.converted_to_po_ids.map(p => <li key={p}><code>{p.slice(0, 8)}</code></li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Dialog open={reject} onOpenChange={setReject}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Reject PR?</DialogTitle>
            <DialogDescription>Berikan alasan agar requester dapat memperbaiki.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} className="glass-input min-h-[100px]" placeholder="Alasan reject…" data-testid="pr-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(false)}>Batal</Button>
            <Button onClick={rejectSubmit} className="pill-active" data-testid="pr-reject-confirm">Reject</Button>
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
