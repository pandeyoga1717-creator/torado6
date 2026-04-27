/** PO Form — create new Purchase Order. Optionally seed from approved PR. */
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

export default function POForm() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const fromPRIds = search.getAll("pr");

  const [outlets, setOutlets] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor_id: "", vendor_name: "",
    outlet_id: "",
    pr_ids: [],
    order_date: todayJakartaISO(),
    expected_delivery_date: "",
    payment_terms_days: 30,
    lines: [{ item_name: "", item_id: null, qty: 1, unit: "pcs", unit_cost: 0, discount: 0, tax_rate: 0 }],
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      api.get("/master/outlets", { params: { per_page: 100 } }),
      api.get("/master/vendors", { params: { per_page: 200 } }),
    ]).then(([o, v]) => {
      setOutlets(unwrap(o) || []);
      setVendors(unwrap(v) || []);
    }).catch(() => {});
  }, []);

  // Optional: seed from approved PRs
  useEffect(() => {
    if (fromPRIds.length === 0) return;
    Promise.all(fromPRIds.map(pid => api.get("/procurement/prs", { params: { per_page: 100 } })))
      .then(results => {
        const allPRs = (unwrap(results[0]) || []);
        const matched = allPRs.filter(p => fromPRIds.includes(p.id));
        if (matched.length === 0) return;
        const lines = matched.flatMap(p => (p.lines || []).map(ln => ({
          item_name: ln.item_name, item_id: ln.item_id,
          qty: ln.qty, unit: ln.unit,
          unit_cost: ln.est_cost || 0,
          discount: 0, tax_rate: 0,
        })));
        setForm(f => ({
          ...f,
          outlet_id: matched[0]?.outlet_id || f.outlet_id,
          pr_ids: matched.map(m => m.id),
          lines,
        }));
      }).catch(() => {});
  }, [fromPRIds.length]); // eslint-disable-line

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, { item_name: "", item_id: null, qty: 1, unit: "pcs", unit_cost: 0, discount: 0, tax_rate: 0 }] }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    form.lines.forEach(l => {
      const lineSub = Number(l.qty || 0) * Number(l.unit_cost || 0) - Number(l.discount || 0);
      const lineTax = lineSub * Number(l.tax_rate || 0);
      subtotal += lineSub; tax += lineTax;
    });
    return { subtotal, tax, grand: subtotal + tax };
  }, [form.lines]);

  async function save() {
    if (!form.vendor_id) { toast.error("Vendor wajib"); return; }
    if (form.lines.length === 0 || form.lines.some(l => !l.item_name || !l.qty)) {
      toast.error("Lengkapi line items"); return;
    }
    setSaving(true);
    try {
      const payload = {
        vendor_id: form.vendor_id,
        outlet_id: form.outlet_id || null,
        pr_ids: form.pr_ids || [],
        order_date: form.order_date,
        expected_delivery_date: form.expected_delivery_date || null,
        payment_terms_days: Number(form.payment_terms_days || 30),
        lines: form.lines.map(l => ({
          item_id: l.item_id, item_name: l.item_name,
          qty: Number(l.qty), unit: l.unit,
          unit_cost: Number(l.unit_cost || 0),
          discount: Number(l.discount || 0),
          tax_rate: Number(l.tax_rate || 0),
        })),
        notes: form.notes,
      };
      const res = await api.post("/procurement/pos", payload);
      const po = unwrap(res);
      toast.success("PO dibuat");
      navigate(`/procurement/po/${po.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">PO Baru</h2>
        <div className="ml-auto">
          <Button onClick={save} disabled={saving} className="rounded-full pill-active gap-2" data-testid="po-save">
            <Save className="h-4 w-4" /> {saving ? "…" : "Simpan"}
          </Button>
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Label className="text-xs uppercase text-muted-foreground">Vendor *</Label>
          <VendorAutocomplete
            value={form.vendor_name}
            onChange={v => setForm(f => ({ ...f, vendor_name: v, vendor_id: null }))}
            onSelect={v => setForm(f => ({ ...f, vendor_name: v.name, vendor_id: v.id }))}
            placeholder="Cari vendor…"
            dataTestId="po-vendor"
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Delivery Outlet</Label>
          <select value={form.outlet_id}
            onChange={e => setForm(f => ({ ...f, outlet_id: e.target.value }))}
            className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1">
            <option value="">Central / Belum ditentukan</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Order Date</Label>
          <Input type="date" value={form.order_date}
            onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))}
            className="glass-input mt-1" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Expected Delivery</Label>
          <Input type="date" value={form.expected_delivery_date}
            onChange={e => setForm(f => ({ ...f, expected_delivery_date: e.target.value }))}
            className="glass-input mt-1" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Payment Terms (hari)</Label>
          <Input type="number" min="0" value={form.payment_terms_days}
            onChange={e => setForm(f => ({ ...f, payment_terms_days: e.target.value }))}
            className="glass-input mt-1" />
        </div>
      </div>

      {form.pr_ids.length > 0 && (
        <div className="glass-card p-4 text-sm">
          <strong>Source PR:</strong>{" "}
          {form.pr_ids.map(p => <code key={p} className="text-xs mr-2">{p.slice(0, 8)}</code>)}
        </div>
      )}

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Line Items</h3>
          <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1" data-testid="po-add-line">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th className="min-w-[200px]">Item</Th>
              <Th className="text-right w-20">Qty</Th>
              <Th className="w-20">Unit</Th>
              <Th className="text-right w-32">Unit Cost</Th>
              <Th className="text-right w-24">Disc</Th>
              <Th className="text-right w-20">Tax%</Th>
              <Th className="text-right w-32">Subtotal</Th>
              <Th></Th>
            </tr></thead>
            <tbody>
              {form.lines.map((ln, i) => {
                const sub = Number(ln.qty || 0) * Number(ln.unit_cost || 0) - Number(ln.discount || 0);
                const total = sub * (1 + Number(ln.tax_rate || 0));
                return (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-2">
                      <ItemAutocomplete
                        value={ln.item_name}
                        onChange={v => setLine(i, "item_name", v)}
                        onSelect={(it) => {
                          setForm(f => {
                            const lines = [...f.lines];
                            lines[i] = {
                              ...lines[i], item_name: it.name, item_id: it.id,
                              unit: it.unit || lines[i].unit,
                              unit_cost: it.last_price ?? lines[i].unit_cost,
                            };
                            return { ...f, lines };
                          });
                        }}
                        dataTestId={`po-line-item-${i}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" value={ln.qty}
                        onChange={e => setLine(i, "qty", e.target.value)}
                        className="glass-input h-9 text-right tabular-nums"
                        data-testid={`po-line-qty-${i}`} />
                    </td>
                    <td className="px-3 py-2">
                      <Input value={ln.unit} onChange={e => setLine(i, "unit", e.target.value)} className="glass-input h-9" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" value={ln.unit_cost}
                        onChange={e => setLine(i, "unit_cost", e.target.value)}
                        className="glass-input h-9 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" value={ln.discount}
                        onChange={e => setLine(i, "discount", e.target.value)}
                        className="glass-input h-9 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" step="0.01" min="0" value={ln.tax_rate}
                        onChange={e => setLine(i, "tax_rate", e.target.value)}
                        className="glass-input h-9 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtRp(total)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeLine(i)} className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 max-w-sm ml-auto space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmtRp(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{fmtRp(totals.tax)}</span></div>
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
