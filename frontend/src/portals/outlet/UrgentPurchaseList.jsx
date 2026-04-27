/** Urgent Purchase — list + create dialog + finance approve. */
import { useEffect, useMemo, useState } from "react";
import { Plus, ShoppingBag, Trash2, CheckCircle2 } from "lucide-react";
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
import VendorAutocomplete from "@/components/shared/VendorAutocomplete";
import ReceiptCapture from "@/components/shared/ReceiptCapture";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const STATUS_TABS = [
  { key: "",          label: "Semua" },
  { key: "submitted", label: "Menunggu Approval" },
  { key: "approved",  label: "Approved" },
  { key: "rejected",  label: "Rejected" },
];

export default function UrgentPurchaseList() {
  const { user, can } = useAuth();
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [outletId, setOutletId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });

  const userOutlets = useMemo(() => {
    if ((user?.permissions || []).includes("*")) return outlets;
    const ids = new Set(user?.outlet_ids || []);
    return outlets.filter(o => ids.has(o.id));
  }, [outlets, user]);

  useEffect(() => {
    Promise.all([
      api.get("/master/outlets", { params: { per_page: 100 } }),
      api.get("/master/payment-methods", { params: { per_page: 100 } }),
    ]).then(([o, p]) => {
      setOutlets(unwrap(o) || []);
      setPaymentMethods(unwrap(p) || []);
    }).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (status) params.status = status;
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/outlet/urgent-purchases", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [page, status, outletId]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  async function approve(up) {
    if (!confirm(`Approve urgent purchase ${up.doc_no || up.id}?`)) return;
    try {
      await api.post(`/outlet/urgent-purchases/${up.id}/approve`);
      toast.success("Disetujui. Jurnal dibuat.");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal approve");
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <select
            value={outletId} onChange={e => { setOutletId(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            data-testid="up-outlet"
          >
            <option value="">Semua</option>
            {userOutlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <Button onClick={() => setShowForm(true)} className="ml-auto rounded-full pill-active gap-2 h-10" data-testid="up-new">
          <Plus className="h-4 w-4" /> Urgent Purchase Baru
        </Button>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => (
          <button
            key={t.key || "all"}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
              status === t.key ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground"
            }`}
            data-testid={`up-tab-${t.key || "all"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border/50">
                <Th>Doc No</Th>
                <Th>Tanggal</Th>
                <Th>Outlet</Th>
                <Th>Vendor</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-6"><LoadingState rows={5} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7}>
                  <EmptyState icon={ShoppingBag} title="Belum ada urgent purchase" description="Buat ketika ada kebutuhan mendadak yang tidak bisa lewat PR normal." />
                </td></tr>
              )}
              {!loading && items.map(up => {
                const ot = outlets.find(o => o.id === up.outlet_id);
                return (
                  <tr key={up.id} className="border-b border-border/30 hover:bg-foreground/5">
                    <td className="px-5 py-3 font-mono text-xs">{up.doc_no || up.id.slice(0, 8)}</td>
                    <td className="px-5 py-3">{fmtDate(up.purchase_date)}</td>
                    <td className="px-5 py-3">{ot?.name || up.outlet_id}</td>
                    <td className="px-5 py-3">{up.vendor_text || up.vendor_id || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmtRp(up.total || 0)}</td>
                    <td className="px-5 py-3"><StatusPill status={up.status} /></td>
                    <td className="px-5 py-3 text-right">
                      {up.status === "submitted" && can("finance.payment.approve") && (
                        <Button onClick={() => approve(up)} size="sm" className="rounded-full pill-active gap-1 h-7 px-3" data-testid={`up-approve-${up.id}`}>
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </Button>
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

      <UrgentPurchaseForm
        open={showForm} userOutlets={userOutlets} paymentMethods={paymentMethods}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); load(); }}
      />
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}

function UrgentPurchaseForm({ open, userOutlets, paymentMethods, onClose, onSaved }) {
  const [form, setForm] = useState(emptyUP());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        ...emptyUP(),
        purchase_date: todayJakartaISO(),
        outlet_id: userOutlets[0]?.id || "",
      });
    }
  }, [open, userOutlets]);

  if (!open) return null;

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.items];
      lines[i] = { ...lines[i], [key]: val };
      const qty = Number(lines[i].qty || 0);
      const cost = Number(lines[i].cost || 0);
      lines[i].total = Math.round(qty * cost * 100) / 100;
      return { ...f, items: lines };
    });
  }
  function addLine() {
    setForm(f => ({
      ...f, items: [...f.items, { name: "", qty: 1, unit: "pcs", cost: 0, total: 0 }],
    }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }
  const total = form.items.reduce((s, l) => s + Number(l.total || 0), 0);

  const submit = async () => {
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    if (form.items.length === 0) { toast.error("Tambahkan minimal 1 item"); return; }
    if (form.items.some(it => !it.name || !it.qty)) { toast.error("Lengkapi semua item"); return; }
    setSaving(true);
    try {
      const payload = {
        outlet_id: form.outlet_id,
        purchase_date: form.purchase_date,
        vendor_id: form.vendor_id || null,
        vendor_text: form.vendor_text || null,
        items: form.items.map(it => ({
          name: it.name, qty: Number(it.qty), unit: it.unit, cost: Number(it.cost || 0),
          total: Number(it.total || 0),
        })),
        payment_method_id: form.payment_method_id || null,
        paid_by: form.paid_by || null,
        receipt_url: form.receipt_url || null,
        notes: form.notes,
      };
      await api.post("/outlet/urgent-purchases", payload);
      toast.success("Urgent purchase dibuat");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  const handleOCRExtracted = (data) => {
    setForm(f => {
      const next = { ...f };
      if (!f.vendor_text && data.vendor_name) {
        next.vendor_text = data.vendor_name;
      }
      if (data.receipt_date) {
        next.purchase_date = data.receipt_date;
      }
      // Replace items if user has only the empty single line and OCR returned items
      const existing = f.items;
      const isSingleEmpty = existing.length === 1 && !existing[0].name && !Number(existing[0].cost);
      if (isSingleEmpty && data.items?.length) {
        next.items = data.items.map(it => ({
          name: it.name || "",
          qty: Number(it.qty || 1),
          unit: it.unit || "pcs",
          cost: Number(it.price || 0),
          total: Number(it.total || (Number(it.qty || 1) * Number(it.price || 0))),
        }));
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Urgent Purchase Baru</DialogTitle>
          <DialogDescription>Untuk pembelian mendadak yang tidak melalui PR normal.</DialogDescription>
        </DialogHeader>

        <div className="mb-3">
          <ReceiptCapture
            onExtracted={handleOCRExtracted}
            onImage={(dataUrl) => setForm(f => ({ ...f, receipt_url: dataUrl }))}
            compact
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Outlet *</Label>
            <select
              value={form.outlet_id}
              onChange={e => setForm(f => ({ ...f, outlet_id: e.target.value }))}
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
              data-testid="up-form-outlet"
            >
              <option value="">-- pilih outlet --</option>
              {userOutlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tanggal *</Label>
            <Input type="date" value={form.purchase_date}
              onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
              className="glass-input mt-1" data-testid="up-form-date"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vendor</Label>
            <VendorAutocomplete
              value={form.vendor_text}
              onChange={v => setForm(f => ({ ...f, vendor_text: v, vendor_id: null }))}
              onSelect={(v) => setForm(f => ({ ...f, vendor_text: v.name, vendor_id: v.id }))}
              dataTestId="up-form-vendor"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payment Method</Label>
            <select
              value={form.payment_method_id}
              onChange={e => setForm(f => ({ ...f, payment_method_id: e.target.value }))}
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
              data-testid="up-form-pm"
            >
              <option value="">-- pilih --</option>
              {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Paid By</Label>
            <Input value={form.paid_by}
              onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
              placeholder="Nama pegawai/keterangan"
              className="glass-input mt-1"
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Items</h4>
            <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1" data-testid="up-add-line">
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          </div>
          {form.items.length === 0 && (
            <div className="text-sm text-muted-foreground italic py-3 text-center">
              Belum ada item. Klik Tambah untuk mulai.
            </div>
          )}
          {form.items.map((ln, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center mb-2">
              <div className="col-span-5">
                <ItemAutocomplete
                  value={ln.name}
                  onChange={v => setLine(i, "name", v)}
                  onSelect={(it) => {
                    setForm(f => {
                      const lines = [...f.items];
                      lines[i] = {
                        ...lines[i], name: it.name, item_id: it.id,
                        unit: it.unit || lines[i].unit,
                        cost: it.last_price ?? lines[i].cost,
                      };
                      lines[i].total = Number(lines[i].qty || 0) * Number(lines[i].cost || 0);
                      return { ...f, items: lines };
                    });
                  }}
                  placeholder="Nama item…"
                  dataTestId={`up-line-name-${i}`}
                />
              </div>
              <Input
                type="number" min="0" value={ln.qty}
                onChange={e => setLine(i, "qty", e.target.value)}
                className="glass-input col-span-2 h-9 text-right tabular-nums"
                placeholder="Qty" data-testid={`up-line-qty-${i}`}
              />
              <Input
                value={ln.unit}
                onChange={e => setLine(i, "unit", e.target.value)}
                className="glass-input col-span-1 h-9"
                placeholder="unit"
              />
              <Input
                type="number" min="0" value={ln.cost}
                onChange={e => setLine(i, "cost", e.target.value)}
                className="glass-input col-span-2 h-9 text-right tabular-nums"
                placeholder="Harga" data-testid={`up-line-cost-${i}`}
              />
              <div className="col-span-1 text-right text-sm tabular-nums font-medium">{fmtRp(ln.total || 0)}</div>
              <button onClick={() => removeLine(i)} className="col-span-1 h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex justify-between pt-3 border-t border-border/50 text-sm font-bold">
            <span>Grand Total</span>
            <span className="tabular-nums">{fmtRp(total)}</span>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
          <Textarea value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="glass-input mt-1 min-h-[60px]" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="up-save">
            {saving ? "…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyUP() {
  return {
    outlet_id: "",
    purchase_date: todayJakartaISO(),
    vendor_id: null, vendor_text: "",
    items: [{ name: "", qty: 1, unit: "pcs", cost: 0, total: 0 }],
    payment_method_id: "", paid_by: "",
    receipt_url: "",
    notes: "",
  };
}
