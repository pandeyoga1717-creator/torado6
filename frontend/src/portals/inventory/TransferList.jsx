/** Transfer List + create + send/receive actions. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Truck, Send, Inbox, Trash2 } from "lucide-react";
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
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function TransferList() {
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
      const res = await api.get("/inventory/transfers", { params: { page, per_page: 20 } });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load transfers");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);

  async function send(t) {
    if (!confirm("Kirim transfer? Stock akan dikurangi dari outlet asal.")) return;
    try {
      await api.post(`/inventory/transfers/${t.id}/send`);
      toast.success("Transfer dikirim"); load();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
  }
  async function receive(t) {
    if (!confirm("Konfirmasi penerimaan? Stock akan masuk ke outlet tujuan.")) return;
    try {
      await api.post(`/inventory/transfers/${t.id}/receive`);
      toast.success("Transfer diterima"); load();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
  }

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Stock Transfers</h3>
          <p className="text-xs text-muted-foreground">Pindahkan stok antar outlet.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-full pill-active gap-2 h-10" data-testid="trf-new" disabled={!can("inventory.transfer.create")}>
          <Plus className="h-4 w-4" /> Transfer Baru
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Doc No</Th><Th>Tanggal</Th><Th>Dari</Th><Th>Ke</Th>
              <Th className="text-right">Lines</Th>
              <Th className="text-right">Total Value</Th>
              <Th>Status</Th><Th></Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="p-6"><LoadingState rows={5} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState icon={Truck} title="Belum ada transfer" description="Buat transfer untuk memindah stok antar outlet." />
                </td></tr>
              )}
              {!loading && items.map(t => (
                <tr key={t.id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3 font-mono text-xs">{t.doc_no || t.id.slice(0, 8)}</td>
                  <td className="px-5 py-3">{fmtDate(t.transfer_date)}</td>
                  <td className="px-5 py-3">{outletMap[t.from_outlet_id]?.name || t.from_outlet_id}</td>
                  <td className="px-5 py-3">{outletMap[t.to_outlet_id]?.name || t.to_outlet_id}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{t.lines?.length || 0}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmtRp(t.total_value || 0)}</td>
                  <td className="px-5 py-3"><StatusPill status={t.status} /></td>
                  <td className="px-5 py-3 text-right">
                    {t.status === "draft" && can("inventory.transfer.send") && (
                      <Button onClick={() => send(t)} size="sm" className="rounded-full pill-active gap-1 h-7 px-3" data-testid={`trf-send-${t.id}`}>
                        <Send className="h-3 w-3" /> Kirim
                      </Button>
                    )}
                    {t.status === "sent" && can("inventory.transfer.receive") && (
                      <Button onClick={() => receive(t)} size="sm" className="rounded-full pill-active gap-1 h-7 px-3" data-testid={`trf-receive-${t.id}`}>
                        <Inbox className="h-3 w-3" /> Terima
                      </Button>
                    )}
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

      <TransferForm open={showForm} outlets={outlets} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}

function TransferForm({ open, outlets, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm({ ...emptyForm(), transfer_date: todayJakartaISO() });
  }, [open]);
  if (!open) return null;

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, { item_name: "", item_id: null, qty: 1, unit: "pcs", unit_cost: 0 }] }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  const total = form.lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_cost || 0), 0);

  const submit = async () => {
    if (!form.from_outlet_id || !form.to_outlet_id) { toast.error("Outlet asal & tujuan wajib"); return; }
    if (form.from_outlet_id === form.to_outlet_id) { toast.error("Outlet asal & tujuan harus berbeda"); return; }
    if (form.lines.some(l => !l.item_name || !l.qty)) { toast.error("Lengkapi line items"); return; }
    setSaving(true);
    try {
      await api.post("/inventory/transfers", {
        from_outlet_id: form.from_outlet_id,
        to_outlet_id: form.to_outlet_id,
        transfer_date: form.transfer_date,
        lines: form.lines.map(l => ({
          item_id: l.item_id, item_name: l.item_name,
          qty: Number(l.qty), unit: l.unit,
          unit_cost: Number(l.unit_cost || 0),
        })),
        notes: form.notes,
      });
      toast.success("Transfer dibuat");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer Baru</DialogTitle>
          <DialogDescription>Status awal akan draft. Klik Kirim untuk mengurangi stok asal.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Dari Outlet *</Label>
            <select value={form.from_outlet_id} onChange={e => setForm(f => ({ ...f, from_outlet_id: e.target.value }))}
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1" data-testid="trf-from">
              <option value="">--</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Ke Outlet *</Label>
            <select value={form.to_outlet_id} onChange={e => setForm(f => ({ ...f, to_outlet_id: e.target.value }))}
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1" data-testid="trf-to">
              <option value="">--</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Tanggal *</Label>
            <Input type="date" value={form.transfer_date}
              onChange={e => setForm(f => ({ ...f, transfer_date: e.target.value }))}
              className="glass-input mt-1" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Line Items</h4>
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
                  dataTestId={`trf-line-item-${i}`}
                />
              </div>
              <Input type="number" min="0" value={ln.qty}
                onChange={e => setLine(i, "qty", e.target.value)}
                className="glass-input col-span-2 h-9 text-right tabular-nums"
                placeholder="Qty" data-testid={`trf-line-qty-${i}`} />
              <Input value={ln.unit} onChange={e => setLine(i, "unit", e.target.value)} className="glass-input col-span-1 h-9" placeholder="unit" />
              <Input type="number" min="0" value={ln.unit_cost}
                onChange={e => setLine(i, "unit_cost", e.target.value)}
                className="glass-input col-span-2 h-9 text-right tabular-nums" placeholder="Cost" />
              <div className="col-span-1 text-right text-xs tabular-nums">{fmtRp(Number(ln.qty || 0) * Number(ln.unit_cost || 0))}</div>
              <button onClick={() => removeLine(i)} className="col-span-1 h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-border/50 text-sm font-bold">
            <span>Total Value</span>
            <span className="tabular-nums">{fmtRp(total)}</span>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
          <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="glass-input mt-1 min-h-[60px]" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="trf-save">{saving ? "…" : "Simpan Draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyForm() {
  return {
    from_outlet_id: "", to_outlet_id: "",
    transfer_date: todayJakartaISO(),
    lines: [{ item_name: "", item_id: null, qty: 1, unit: "pcs", unit_cost: 0 }],
    notes: "",
  };
}
