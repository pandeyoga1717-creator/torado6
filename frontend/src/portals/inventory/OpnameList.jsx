/** Opname List — list sessions + start new (per outlet, snapshot system stock). */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ClipboardCheck, Eye } from "lucide-react";
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
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function OpnameList() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);
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
      const res = await api.get("/inventory/opname", { params: { page, per_page: 20 } });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) { toast.error("Gagal load opname"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Opname Sessions</h3>
          <p className="text-xs text-muted-foreground">Stok fisik vs sistem. Submit untuk mencatat variance &amp; jurnal.</p>
        </div>
        <Button onClick={() => setShowStart(true)} className="rounded-full pill-active gap-2 h-10" data-testid="opn-new" disabled={!can("outlet.opname.execute")}>
          <Plus className="h-4 w-4" /> Mulai Opname
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Doc No</Th><Th>Tanggal</Th><Th>Outlet</Th><Th>Period</Th>
              <Th className="text-right">Counted</Th>
              <Th className="text-right">Variance Value</Th>
              <Th>Status</Th><Th></Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="p-6"><LoadingState rows={5} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8}><EmptyState icon={ClipboardCheck} title="Belum ada opname session" description="Mulai opname untuk men-snapshot dan menghitung stok fisik." /></td></tr>
              )}
              {!loading && items.map(s => (
                <tr key={s.id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3 font-mono text-xs">{s.doc_no || s.id.slice(0, 8)}</td>
                  <td className="px-5 py-3">{fmtDate(s.opname_date)}</td>
                  <td className="px-5 py-3">{outletMap[s.outlet_id]?.name || s.outlet_id}</td>
                  <td className="px-5 py-3">{s.period}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.counted_items || 0} / {s.total_items || 0}</td>
                  <td className={`px-5 py-3 text-right tabular-nums font-semibold ${s.total_variance_value < 0 ? "text-red-700 dark:text-red-400" : ""}`}>
                    {fmtRp(s.total_variance_value || 0)}
                  </td>
                  <td className="px-5 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/inventory/opname/${s.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid={`opn-view-${s.id}`}>
                      <Eye className="h-3.5 w-3.5" /> Buka
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

      <StartOpnameDialog open={showStart} outlets={outlets} onClose={() => setShowStart(false)} onStarted={() => { setShowStart(false); load(); }} />
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}

function StartOpnameDialog({ open, outlets, onClose, onStarted }) {
  const [outletId, setOutletId] = useState("");
  const [period, setPeriod] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setOutletId(outlets[0]?.id || "");
      setPeriod(todayJakartaISO().slice(0, 7));
      setNotes("");
    }
  }, [open, outlets]);
  if (!open) return null;

  const submit = async () => {
    if (!outletId) { toast.error("Outlet wajib"); return; }
    setSaving(true);
    try {
      const res = await api.post("/inventory/opname/start", {
        outlet_id: outletId, period, notes,
      });
      const sess = unwrap(res);
      toast.success(`Opname dimulai — ${sess.doc_no || ""}`);
      onStarted();
      window.location.href = `/inventory/opname/${sess.id}`;
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle>Mulai Opname Session</DialogTitle>
          <DialogDescription>Snapshot stok sistem akan diambil sekarang. Hitung fisik bisa dilakukan bertahap.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Outlet *</Label>
            <select value={outletId} onChange={e => setOutletId(e.target.value)} className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1" data-testid="opn-start-outlet">
              <option value="">--</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Period (YYYY-MM)</Label>
            <Input value={period} onChange={e => setPeriod(e.target.value)} className="glass-input mt-1" placeholder="2026-04" />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="glass-input mt-1 min-h-[60px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="opn-start-confirm">{saving ? "…" : "Mulai"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
