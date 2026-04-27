/** GR Form — post Goods Receipt against PO (or direct). */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import VendorAutocomplete from "@/components/shared/VendorAutocomplete";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";

export default function GRForm() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const fromPO = search.get("po");

  const [outlets, setOutlets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [poInfo, setPoInfo] = useState(null);
  const [form, setForm] = useState({
    po_id: fromPO || "",
    vendor_id: "", vendor_name: "",
    outlet_id: "",
    receive_date: todayJakartaISO(),
    invoice_no: "", invoice_date: "",
    tax_rate: 0,
    payment_terms_days: 30,
    lines: [{ item_name: "", item_id: null, qty_ordered: 0, qty_received: 1, unit: "pcs", unit_cost: 0, condition_note: "" }],
    notes: "",
  });

  useEffect(() => {
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then(r => setOutlets(unwrap(r) || [])).catch(() => {});
  }, []);

  // If PO id present, prefill
  useEffect(() => {
    if (!fromPO) return;
    api.get("/procurement/pos", { params: { per_page: 100 } })
      .then(res => {
        const po = (unwrap(res) || []).find(p => p.id === fromPO);
        if (!po) return;
        setPoInfo(po);
        setForm(f => ({
          ...f,
          po_id: po.id,
          vendor_id: po.vendor_id,
          outlet_id: po.outlet_id || "",
          payment_terms_days: po.payment_terms_days || 30,
          lines: (po.lines || []).map((ln, idx) => ({
            po_line_index: idx,
            item_id: ln.item_id, item_name: ln.item_name,
            qty_ordered: ln.qty || 0,
            qty_received: ln.qty || 0,
            unit: ln.unit, unit_cost: ln.unit_cost || 0,
            condition_note: "",
          })),
        }));
      })
      .catch(() => {});
  }, [fromPO]);

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({
      ...f, lines: [...f.lines, { item_name: "", item_id: null, qty_ordered: 0, qty_received: 1, unit: "pcs", unit_cost: 0, condition_note: "" }],
    }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  const totals = useMemo(() => {
    const subtotal = form.lines.reduce((s, l) => s + Number(l.qty_received || 0) * Number(l.unit_cost || 0), 0);
    const tax = subtotal * Number(form.tax_rate || 0);
    return { subtotal, tax, grand: subtotal + tax };
  }, [form.lines, form.tax_rate]);

  async function save() {
    if (!form.vendor_id) { toast.error("Vendor wajib"); return; }
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    if (form.lines.length === 0 || form.lines.some(l => !l.item_name || !l.qty_received)) {
      toast.error("Lengkapi line items"); return;
    }
    setSaving(true);
    try {
      const payload = {
        po_id: form.po_id || null,
        vendor_id: form.vendor_id,
        outlet_id: form.outlet_id,
        receive_date: form.receive_date,
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date || null,
        tax_rate: Number(form.tax_rate || 0),
        payment_terms_days: Number(form.payment_terms_days || 30),
        lines: form.lines.map(l => ({
          po_line_index: l.po_line_index,
          item_id: l.item_id, item_name: l.item_name,
          qty_ordered: Number(l.qty_ordered || 0),
          qty_received: Number(l.qty_received),
          unit: l.unit, unit_cost: Number(l.unit_cost || 0),
          condition_note: l.condition_note,
        })),
        notes: form.notes,
      };
      const res = await api.post("/procurement/grs", payload);
      const gr = unwrap(res);
      toast.success(`GR ${gr.doc_no} di-posting. Stok & jurnal terbuat.`);
      navigate("/procurement/gr");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal posting");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">Posting Goods Receipt</h2>
        {poInfo && (
          <span className="text-xs px-2 py-1 rounded-full glass-input">PO {poInfo.doc_no || poInfo.id.slice(0, 8)}</span>
        )}
        <div className="ml-auto">
          <Button onClick={save} disabled={saving} className="rounded-full pill-active gap-2" data-testid="gr-save">
            <Save className="h-4 w-4" /> {saving ? "…" : "Post GR"}
          </Button>
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Label className="text-xs uppercase text-muted-foreground">Vendor *</Label>
          {fromPO ? (
            <Input disabled value={form.vendor_name || form.vendor_id} className="glass-input mt-1" />
          ) : (
            <VendorAutocomplete
              value={form.vendor_name}
              onChange={v => setForm(f => ({ ...f, vendor_name: v, vendor_id: null }))}
              onSelect={v => setForm(f => ({ ...f, vendor_name: v.name, vendor_id: v.id }))}
              placeholder="Cari vendor…"
              dataTestId="gr-vendor"
            />
          )}
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Outlet (destinasi) *</Label>
          <select value={form.outlet_id}
            onChange={e => setForm(f => ({ ...f, outlet_id: e.target.value }))}
            className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
            data-testid="gr-outlet">
            <option value="">-- pilih --</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Receive Date</Label>
          <Input type="date" value={form.receive_date}
            onChange={e => setForm(f => ({ ...f, receive_date: e.target.value }))}
            className="glass-input mt-1" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Invoice No</Label>
          <Input value={form.invoice_no}
            onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))}
            placeholder="INV-2026-001"
            className="glass-input mt-1" data-testid="gr-invoice-no" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Invoice Date</Label>
          <Input type="date" value={form.invoice_date}
            onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))}
            className="glass-input mt-1" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Tax Rate (e.g. 0.11)</Label>
          <Input type="number" step="0.01" min="0" value={form.tax_rate}
            onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
            className="glass-input mt-1" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Payment Terms (hari)</Label>
          <Input type="number" min="0" value={form.payment_terms_days}
            onChange={e => setForm(f => ({ ...f, payment_terms_days: e.target.value }))}
            className="glass-input mt-1" />
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Line Items {fromPO && <span className="text-xs text-muted-foreground">(prefilled dari PO)</span>}</h3>
          {!fromPO && (
            <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1">
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th className="min-w-[200px]">Item</Th>
              <Th className="text-right w-24">Qty Order</Th>
              <Th className="text-right w-24">Qty Diterima</Th>
              <Th className="w-20">Unit</Th>
              <Th className="text-right w-32">Unit Cost</Th>
              <Th className="text-right w-32">Total</Th>
              <Th>Note</Th>
              <Th></Th>
            </tr></thead>
            <tbody>
              {form.lines.map((ln, i) => {
                const total = Number(ln.qty_received || 0) * Number(ln.unit_cost || 0);
                const variance = Number(ln.qty_ordered || 0) - Number(ln.qty_received || 0);
                return (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-2">
                      {fromPO ? (
                        <div className="text-sm font-medium">{ln.item_name}</div>
                      ) : (
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
                          dataTestId={`gr-line-item-${i}`}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{ln.qty_ordered || 0}</td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" value={ln.qty_received}
                        onChange={e => setLine(i, "qty_received", e.target.value)}
                        className={`glass-input h-9 text-right tabular-nums ${variance !== 0 ? "ring-1 ring-amber-500/50" : ""}`}
                        data-testid={`gr-line-qty-${i}`} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{ln.unit}</td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" value={ln.unit_cost}
                        onChange={e => setLine(i, "unit_cost", e.target.value)}
                        className="glass-input h-9 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtRp(total)}</td>
                    <td className="px-3 py-2">
                      <Input value={ln.condition_note || ""}
                        onChange={e => setLine(i, "condition_note", e.target.value)}
                        className="glass-input h-9" placeholder="e.g. rusak ringan" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!fromPO && (
                        <button onClick={() => removeLine(i)} className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 max-w-sm ml-auto space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmtRp(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax ({(Number(form.tax_rate) * 100).toFixed(1)}%)</span><span className="tabular-nums">{fmtRp(totals.tax)}</span></div>
          <div className="flex justify-between pt-2 border-t border-border/50 text-base font-bold"><span>Grand Total</span><span className="tabular-nums">{fmtRp(totals.grand)}</span></div>
        </div>
      </div>

      <div className="glass-card p-5">
        <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
        <Textarea value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="glass-input mt-1 min-h-[80px]" />
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
