/** Payroll Cycle — list + create + approve + post. */
import { useEffect, useState } from "react";
import { Plus, CalendarClock, ArrowUpCircle, CheckCircle2 } from "lucide-react";
import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PayrollList() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const canApprove = (user?.permissions || []).includes("hr.advance.approve")
    || (user?.permissions || []).includes("*");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/hr/payroll", { params: { per_page: 30 } });
      setItems(unwrap(r) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then(r => setOutlets(unwrap(r) || []));
    load();
  }, []);

  return (
    <div className="space-y-4" data-testid="hr-payroll-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          Payroll cycle bulanan — mengkonsolidasi gaji + service share + incentive − cicilan kasbon.
        </div>
        {canApprove && (
          <Button onClick={() => setShowForm(true)} className="rounded-full" data-testid="hr-payroll-create">
            <Plus className="h-4 w-4 mr-2" /> Generate Payroll
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Belum ada payroll cycle"
          description="Generate payroll bulanan untuk membuat draft, lalu approve & post ke jurnal." />
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3">Doc No</th>
                <th className="text-left px-4 py-3">Period</th>
                <th className="text-left px-4 py-3">Outlet</th>
                <th className="text-right px-4 py-3">Gross</th>
                <th className="text-right px-4 py-3">Advance Repay</th>
                <th className="text-right px-4 py-3">Take Home</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() => setDetailId(it.id)}
                    data-testid={`hr-payroll-row-${it.id}`}>
                  <td className="px-4 py-3 font-mono text-xs">{it.doc_no}</td>
                  <td className="px-4 py-3 font-mono">{it.period}</td>
                  <td className="px-4 py-3">{outlets.find(o => o.id === it.outlet_id)?.name || (it.outlet_id ? it.outlet_id.slice(0,8) : "All")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtRp(it.total_gross)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs">{fmtRp(it.total_advance_repayment)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtRp(it.total_take_home)}</td>
                  <td className="px-4 py-3 text-center"><StatusPill status={it.status} /></td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {canApprove && it.status !== "posted" && (
                      <Button size="sm" variant="default" className="rounded-full"
                              onClick={async () => {
                                try {
                                  await api.post(`/hr/payroll/${it.id}/post`);
                                  toast.success("Payroll di-post");
                                  await load();
                                } catch (e) { toast.error(unwrapError(e)); }
                              }}
                              data-testid={`hr-payroll-post-${it.id}`}>
                        <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Post
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PayrollFormDialog open={showForm} onOpenChange={setShowForm}
        outlets={outlets}
        onCreated={async () => { setShowForm(false); await load(); }} />
      <PayrollDetailDialog pid={detailId} open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        outlets={outlets}
        canApprove={canApprove}
        onPosted={async () => { setDetailId(null); await load(); }} />
    </div>
  );
}

function PayrollFormDialog({ open, onOpenChange, outlets, onCreated }) {
  const [form, setForm] = useState({ period: currentPeriod(), outlet_id: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post("/hr/payroll", {
        period: form.period,
        outlet_id: form.outlet_id || undefined,
      });
      toast.success("Payroll cycle dibuat (draft)");
      await onCreated();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="hr-payroll-form-dialog">
        <DialogHeader>
          <DialogTitle>Generate Payroll Cycle</DialogTitle>
          <DialogDescription>Auto-konsolidasi gaji + service + incentive − advance.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Period *</Label>
            <Input type="month" value={form.period}
                    onChange={(e) => setForm(f => ({ ...f, period: e.target.value }))}
                    data-testid="hr-payroll-period" />
          </div>
          <div className="space-y-1">
            <Label>Outlet</Label>
            <Select value={form.outlet_id || "all"} onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v === "all" ? "" : v }))}>
              <SelectTrigger data-testid="hr-payroll-outlet"><SelectValue placeholder="— Group-wide —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">— Group-wide —</SelectItem>
                {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-full"
                  data-testid="hr-payroll-submit">
            {submitting ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayrollDetailDialog({ pid, open, onOpenChange, outlets, canApprove, onPosted }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pid) { setData(null); return; }
    api.get(`/hr/payroll/${pid}`).then(r => setData(unwrap(r))).catch(() => {});
  }, [pid]);

  const handlePost = async () => {
    setBusy(true);
    try {
      await api.post(`/hr/payroll/${pid}/post`);
      toast.success("Payroll posted (advance schedule auto-paid)");
      await onPosted();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="hr-payroll-detail">
        <DialogHeader>
          <DialogTitle>Payroll Detail</DialogTitle>
          {data && (
            <DialogDescription>
              {data.doc_no} · Period <span className="font-mono">{data.period}</span> · <StatusPill status={data.status} />
              {' '}· {outlets.find(o => o.id === data.outlet_id)?.name || "Group-wide"}
            </DialogDescription>
          )}
        </DialogHeader>
        {!data ? (<LoadingState rows={5} />) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Tile label="Total Gross" value={fmtRp(data.total_gross)} />
              <Tile label="Allowances" value={fmtRp(data.total_allowances)} />
              <Tile label="Advance Repay" value={fmtRp(data.total_advance_repayment)} />
              <Tile label="Total Take Home" value={fmtRp(data.total_take_home)} highlight />
            </div>
            <div className="glass-card overflow-hidden">
              <table className="w-full text-xs">
                <thead className="uppercase text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="text-left px-3 py-2">Karyawan</th>
                    <th className="text-right px-3 py-2">Basic</th>
                    <th className="text-right px-3 py-2">Service</th>
                    <th className="text-right px-3 py-2">Incentive</th>
                    <th className="text-right px-3 py-2">Gross</th>
                    <th className="text-right px-3 py-2">Advance</th>
                    <th className="text-right px-3 py-2">Take Home</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.employees || []).map((e, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="px-3 py-2">{e.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtRp(e.basic)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtRp(e.service_share)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtRp(e.incentive_share)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtRp(e.gross)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">{fmtRp(-e.advance_repayment)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{fmtRp(e.take_home)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
          {canApprove && data && data.status !== "posted" && (
            <Button onClick={handlePost} disabled={busy} className="rounded-full"
                    data-testid="hr-payroll-detail-post">
              {busy ? "Posting…" : "Post Payroll"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Tile({ label, value, highlight }) {
  return (
    <div className={highlight ? "glass-card p-3 ring-1 ring-aurora" : "glass-card-hover p-3"}>
      <div className="text-[11px] uppercase text-muted-foreground mb-1">{label}</div>
      <div className="text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}
