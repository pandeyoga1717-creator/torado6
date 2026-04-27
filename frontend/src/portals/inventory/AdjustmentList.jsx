/** Adjustment list + create + approve (multi-tier aware). */
import { useEffect, useMemo, useState } from "react";
import { Plus, Sliders, CheckCircle2, Trash2, XCircle, Eye, ChevronDown } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import ApprovalProgress from "@/components/shared/ApprovalProgress";
import ApprovalChain from "@/components/shared/ApprovalChain";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const REASONS = [
  { v: "waste", l: "Waste / Buang" },
  { v: "damage", l: "Damage / Rusak" },
  { v: "correction", l: "Correction / Koreksi" },
  { v: "other", l: "Other" },
];

export default function AdjustmentList() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
      const res = await api.get("/inventory/adjustments", { params: { page, per_page: 20 } });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) { toast.error("Gagal load adjustments"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);

  async function approve(a) {
    if (!confirm(`Approve adjustment ${a.doc_no || a.id.slice(0, 8)}?`)) return;
    try {
      await api.post(`/inventory/adjustments/${a.id}/approve`, { note: "approved" });
      toast.success("Approved"); load();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
  }

  const [rejectDlg, setRejectDlg] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [stateDlg, setStateDlg] = useState(null);
  const [stateData, setStateData] = useState(null);

  async function openState(a) {
    setStateDlg(a);
    setStateData(null);
    try {
      const res = await api.get(`/inventory/adjustments/${a.id}/approval-state`);
      setStateData(unwrap(res));
    } catch { setStateData(null); }
  }

  async function rejectSubmit() {
    if (!rejectReason.trim()) { toast.error("Alasan wajib"); return; }
    try {
      await api.post(`/inventory/adjustments/${rejectDlg.id}/reject`, { reason: rejectReason });
      toast.success("Rejected");
      setRejectDlg(null); setRejectReason("");
      load();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
  }

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Stock Adjustments</h3>
          <p className="text-xs text-muted-foreground">Catat waste/damage/koreksi stok. Approval menghasilkan jurnal.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-full pill-active gap-2 h-10" data-testid="adj-new" disabled={!can("inventory.adjustment.create")}>
          <Plus className="h-4 w-4" /> Adjustment Baru
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Doc No</Th><Th>Tanggal</Th><Th>Outlet</Th><Th>Reason</Th>
              <Th className="text-right">Lines</Th>
              <Th className="text-right">Total Value</Th>
              <Th>Status</Th><Th></Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="p-6"><LoadingState rows={5} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8}><EmptyState icon={Sliders} title="Belum ada adjustment" /></td></tr>
              )}
              {!loading && items.map(a => (
                <tr key={a.id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3 font-mono text-xs">{a.doc_no || a.id.slice(0, 8)}</td>
                  <td className="px-5 py-3">{fmtDate(a.adjustment_date)}</td>
                  <td className="px-5 py-3">{outletMap[a.outlet_id]?.name || a.outlet_id}</td>
                  <td className="px-5 py-3 capitalize">{a.reason}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{a.lines?.length || 0}</td>
                  <td className={cn("px-5 py-3 text-right tabular-nums font-semibold", a.total_value < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                    {fmtRp(a.total_value || 0)}
                  </td>
                  <td className="px-5 py-3"><StatusPill status={a.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button onClick={() => openState(a)}
                        className="h-7 w-7 rounded-full hover:bg-foreground/5 flex items-center justify-center" title="Lihat approval state"
                        data-testid={`adj-state-${a.id}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {(a.status === "submitted" || a.status === "awaiting_approval") && can("inventory.adjustment.approve") && (
                        <>
                          <Button onClick={() => approve(a)} size="sm" className="rounded-full pill-active gap-1 h-7 px-3" data-testid={`adj-approve-${a.id}`}>
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </Button>
                          <Button onClick={() => { setRejectDlg(a); setRejectReason(""); }} size="sm" variant="outline"
                            className="rounded-full gap-1 h-7 px-3 text-red-600" data-testid={`adj-reject-${a.id}`}>
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                        </>
                      )}
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

      <AdjustmentForm open={showForm} outlets={outlets} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />

      {/* Reject dialog */}
      <Dialog open={!!rejectDlg} onOpenChange={(v) => !v && setRejectDlg(null)}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Adjustment?</DialogTitle>
            <DialogDescription>{rejectDlg?.doc_no || rejectDlg?.id?.slice(0, 8)}</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Alasan reject…" className="glass-input min-h-[100px]" data-testid="adj-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDlg(null)}>Batal</Button>
            <Button onClick={rejectSubmit} className="pill-active" data-testid="adj-reject-confirm">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval state detail */}
      <Dialog open={!!stateDlg} onOpenChange={(v) => !v && setStateDlg(null)}>
        <DialogContent className="glass-card max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approval Detail · {stateDlg?.doc_no || stateDlg?.id?.slice(0, 8)}</DialogTitle>
            <DialogDescription>Tier, step saat ini, dan timeline approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Approval Progress</h4>
              <ApprovalProgress state={stateData} />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Timeline</h4>
              <ApprovalChain chain={stateDlg?.approval_chain || []} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}

function AdjustmentForm({ open, outlets, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm({ ...emptyForm(), adjustment_date: todayJakartaISO() }); }, [open]);
  if (!open) return null;

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, { item_name: "", item_id: null, qty_delta: 0, unit: "pcs", unit_cost: 0, notes: "" }] }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  const total = form.lines.reduce((s, l) => s + Number(l.qty_delta || 0) * Number(l.unit_cost || 0), 0);

  const submit = async () => {
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    if (form.lines.some(l => !l.item_name)) { toast.error("Lengkapi line items"); return; }
    setSaving(true);
    try {
      await api.post("/inventory/adjustments", {
        outlet_id: form.outlet_id,
        adjustment_date: form.adjustment_date,
        reason: form.reason,
        lines: form.lines.map(l => ({
          item_id: l.item_id, item_name: l.item_name,
          qty_delta: Number(l.qty_delta || 0),
          unit: l.unit, unit_cost: Number(l.unit_cost || 0),
          notes: l.notes,
        })),
        notes: form.notes,
      });
      toast.success("Adjustment dibuat");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjustment Baru</DialogTitle>
          <DialogDescription>Status awal submitted, perlu approval untuk update stok &amp; jurnal.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Outlet *</Label>
            <select value={form.outlet_id} onChange={e => setForm(f => ({ ...f, outlet_id: e.target.value }))}
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1" data-testid="adj-outlet">
              <option value="">--</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Tanggal *</Label>
            <Input type="date" value={form.adjustment_date}
              onChange={e => setForm(f => ({ ...f, adjustment_date: e.target.value }))}
              className="glass-input mt-1" />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Reason *</Label>
            <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1" data-testid="adj-reason">
              {REASONS.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Line Items <span className="text-xs text-muted-foreground">(qty_delta: negatif = kurangi, positif = tambah)</span></h4>
            <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1">
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          </div>
          {form.lines.map((ln, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center mb-2">
              <div className="col-span-5">
                <ItemAutocomplete
                  value={ln.item_name}
                  onChange={v => setLine(i, "item_name", v)}
                  onSelect={(it) => {
                    setForm(f => {
                      const lines = [...f.lines];
                      lines[i] = { ...lines[i], item_name: it.name, item_id: it.id, unit: it.unit || lines[i].unit, unit_cost: it.last_price ?? lines[i].unit_cost };
                      return { ...f, lines };
                    });
                  }}
                  dataTestId={`adj-line-item-${i}`}
                />
              </div>
              <Input type="number" value={ln.qty_delta}
                onChange={e => setLine(i, "qty_delta", e.target.value)}
                className="glass-input col-span-2 h-9 text-right tabular-nums" placeholder="±Qty" data-testid={`adj-line-qty-${i}`} />
              <Input value={ln.unit} onChange={e => setLine(i, "unit", e.target.value)} className="glass-input col-span-1 h-9" />
              <Input type="number" min="0" value={ln.unit_cost} onChange={e => setLine(i, "unit_cost", e.target.value)} className="glass-input col-span-2 h-9 text-right tabular-nums" placeholder="Cost" />
              <div className="col-span-1 text-right text-xs tabular-nums">{fmtRp(Number(ln.qty_delta || 0) * Number(ln.unit_cost || 0))}</div>
              <button onClick={() => removeLine(i)} className="col-span-1 h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-border/50 text-sm font-bold">
            <span>Total Value</span>
            <span className={cn("tabular-nums", total < 0 ? "text-red-700 dark:text-red-400" : "")}>{fmtRp(total)}</span>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
          <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="glass-input mt-1 min-h-[60px]" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="adj-save">{saving ? "…" : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyForm() {
  return {
    outlet_id: "", reason: "waste",
    adjustment_date: todayJakartaISO(),
    lines: [{ item_name: "", item_id: null, qty_delta: 0, unit: "pcs", unit_cost: 0, notes: "" }],
    notes: "",
  };
}
