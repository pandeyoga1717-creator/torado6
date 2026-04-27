/** Daily Sales Form — schema-driven manual entry. Channels + Revenue Buckets + Payment + SC + Tax. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Save, Send, ArrowLeft, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import StatusPill from "@/components/shared/StatusPill";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const DEFAULT_CHANNELS = [
  { channel: "dine_in",  label: "Dine-in" },
  { channel: "take_away", label: "Take Away" },
  { channel: "gofood",   label: "GoFood" },
  { channel: "grabfood", label: "GrabFood" },
  { channel: "shopeefood", label: "ShopeeFood" },
  { channel: "other",    label: "Other" },
];

const DEFAULT_BUCKETS = [
  { bucket: "food", label: "Food" },
  { bucket: "beverage", label: "Beverage" },
  { bucket: "other", label: "Other" },
];

export default function DailySalesForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!id;

  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    id: null,
    outlet_id: "",
    brand_id: "",
    sales_date: todayJakartaISO(),
    channels: DEFAULT_CHANNELS.map(c => ({ ...c, gross: 0, discount: 0, net: 0 })),
    revenue_buckets: DEFAULT_BUCKETS.map(b => ({ ...b, amount: 0 })),
    payment_breakdown: [],
    service_charge: 0,
    tax_amount: 0,
    transaction_count: 0,
    notes: "",
    status: "draft",
    rejected_reason: null,
  });

  // Load masters
  useEffect(() => {
    Promise.all([
      api.get("/master/outlets", { params: { per_page: 100 } }),
      api.get("/master/brands", { params: { per_page: 100 } }),
      api.get("/master/payment-methods", { params: { per_page: 100 } }),
    ]).then(([o, b, p]) => {
      setOutlets(unwrap(o) || []);
      setBrands(unwrap(b) || []);
      setPaymentMethods(unwrap(p) || []);
    }).catch(() => {});
  }, []);

  // Default outlet if user only has 1
  useEffect(() => {
    if (form.outlet_id) return;
    const userOutlets = user?.outlet_ids || [];
    if (userOutlets.length === 1) setForm(f => ({ ...f, outlet_id: userOutlets[0] }));
  }, [user]); // eslint-disable-line

  // Load existing
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/outlet/daily-sales/${id}`).then(res => {
      const ds = unwrap(res);
      if (ds) {
        setForm(prev => ({
          ...prev,
          id: ds.id,
          outlet_id: ds.outlet_id,
          brand_id: ds.brand_id || "",
          sales_date: ds.sales_date,
          channels: mergeChannels(ds.channels || [], DEFAULT_CHANNELS),
          revenue_buckets: mergeBuckets(ds.revenue_buckets || [], DEFAULT_BUCKETS),
          payment_breakdown: ds.payment_breakdown || [],
          service_charge: ds.service_charge || 0,
          tax_amount: ds.tax_amount || 0,
          transaction_count: ds.transaction_count || 0,
          notes: ds.notes || "",
          status: ds.status,
          rejected_reason: ds.rejected_reason,
        }));
      }
    }).catch(() => toast.error("Gagal load draft")).finally(() => setLoading(false));
  }, [id]);

  const grossTotal = useMemo(
    () => form.channels.reduce((s, c) => s + Number(c.gross || 0), 0),
    [form.channels],
  );
  const netTotal = useMemo(
    () => form.channels.reduce((s, c) => s + Number(c.net || 0), 0),
    [form.channels],
  );
  const revenueTotal = useMemo(
    () => form.revenue_buckets.reduce((s, b) => s + Number(b.amount || 0), 0),
    [form.revenue_buckets],
  );
  const grandTotal = useMemo(
    () => Number(revenueTotal) + Number(form.service_charge || 0) + Number(form.tax_amount || 0),
    [revenueTotal, form.service_charge, form.tax_amount],
  );
  const paymentTotal = useMemo(
    () => form.payment_breakdown.reduce((s, p) => s + Number(p.amount || 0), 0),
    [form.payment_breakdown],
  );
  const balanced = Math.abs(grandTotal - paymentTotal) < 1;

  function setChannelVal(i, key, val) {
    setForm(f => {
      const c = [...f.channels];
      c[i] = { ...c[i], [key]: val };
      // auto net
      if (key === "gross" || key === "discount") {
        c[i].net = Math.max(0, Number(c[i].gross || 0) - Number(c[i].discount || 0));
      }
      return { ...f, channels: c };
    });
  }

  function setBucketVal(i, val) {
    setForm(f => {
      const b = [...f.revenue_buckets];
      b[i] = { ...b[i], amount: val };
      return { ...f, revenue_buckets: b };
    });
  }

  function addPayment() {
    setForm(f => ({
      ...f,
      payment_breakdown: [
        ...f.payment_breakdown,
        { payment_method_id: "", payment_method_name: "", amount: 0 },
      ],
    }));
  }

  function setPaymentVal(i, key, val) {
    setForm(f => {
      const p = [...f.payment_breakdown];
      p[i] = { ...p[i], [key]: val };
      if (key === "payment_method_id") {
        const pm = paymentMethods.find(x => x.id === val);
        if (pm) p[i].payment_method_name = pm.name;
      }
      return { ...f, payment_breakdown: p };
    });
  }

  function removePayment(i) {
    setForm(f => ({
      ...f,
      payment_breakdown: f.payment_breakdown.filter((_, idx) => idx !== i),
    }));
  }

  async function saveDraft() {
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    if (!form.sales_date) { toast.error("Tanggal wajib"); return; }
    setSaving(true);
    try {
      const payload = {
        outlet_id: form.outlet_id,
        brand_id: form.brand_id || null,
        sales_date: form.sales_date,
        channels: form.channels,
        revenue_buckets: form.revenue_buckets,
        payment_breakdown: form.payment_breakdown,
        service_charge: Number(form.service_charge || 0),
        tax_amount: Number(form.tax_amount || 0),
        transaction_count: Number(form.transaction_count || 0),
        notes: form.notes,
      };
      const res = await api.post("/outlet/daily-sales/draft", payload);
      const saved = unwrap(res);
      toast.success("Draft disimpan");
      if (!form.id && saved?.id) {
        navigate(`/outlet/daily-sales/${saved.id}/edit`, { replace: true });
      } else if (saved) {
        setForm(f => ({ ...f, id: saved.id, status: saved.status }));
      }
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setSaving(false);
    }
  }

  async function submitForValidation() {
    if (!form.id) { toast.error("Simpan draft dulu"); return; }
    if (!balanced) { toast.error("Total pembayaran belum balance dengan grand total"); return; }
    setSubmitting(true);
    try {
      await api.post(`/outlet/daily-sales/${form.id}/submit`);
      toast.success("Daily sales di-submit untuk validasi");
      navigate(`/outlet/daily-sales/${form.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal submit");
    } finally {
      setSubmitting(false);
    }
  }

  const editable = !form.status || form.status === "draft" || form.status === "rejected";

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">{isEdit ? "Edit Daily Sales" : "Daily Sales Baru"}</h2>
        {form.status && <StatusPill status={form.status} />}
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={saveDraft} disabled={!editable || saving}
            variant="outline" className="rounded-full gap-2"
            data-testid="ds-save-draft"
          >
            <Save className="h-4 w-4" /> {saving ? "…" : "Simpan Draft"}
          </Button>
          <Button
            onClick={submitForValidation} disabled={!editable || !form.id || submitting}
            className="rounded-full pill-active gap-2"
            data-testid="ds-submit"
          >
            <Send className="h-4 w-4" /> {submitting ? "…" : "Submit"}
          </Button>
        </div>
      </div>

      {form.status === "rejected" && form.rejected_reason && (
        <div className="glass-card border-l-4 border-red-500 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-red-700 dark:text-red-400">Daily sales ini di-reject Finance</div>
              <div className="text-sm mt-0.5">{form.rejected_reason}</div>
              <div className="text-xs text-muted-foreground mt-1">Edit lalu submit ulang.</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tanggal *</Label>
          <Input
            type="date" value={form.sales_date}
            onChange={e => setForm(f => ({ ...f, sales_date: e.target.value }))}
            disabled={!editable}
            className="glass-input mt-1" data-testid="ds-date"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Outlet *</Label>
          <select
            value={form.outlet_id}
            onChange={e => setForm(f => ({ ...f, outlet_id: e.target.value }))}
            disabled={!editable}
            className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
            data-testid="ds-outlet"
          >
            <option value="">-- Pilih outlet --</option>
            {outlets.filter(o =>
                !user.outlet_ids?.length
                || user.outlet_ids.includes(o.id)
                || (user.permissions || []).includes("*")
            ).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Brand</Label>
          <select
            value={form.brand_id}
            onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}
            disabled={!editable}
            className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
            data-testid="ds-brand"
          >
            <option value="">-- (opsional) --</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Channels */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Channel Sales</h3>
          <span className="text-xs text-muted-foreground">Net total: {fmtRp(netTotal)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border/50">
                <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Channel</th>
                <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Gross</th>
                <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Discount</th>
                <th className="px-3 py-2 text-xs uppercase text-muted-foreground text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {form.channels.map((c, i) => (
                <tr key={c.channel} className="border-b border-border/30">
                  <td className="px-3 py-2 font-medium">{c.label}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number" min="0" value={c.gross}
                      onChange={e => setChannelVal(i, "gross", e.target.value)}
                      disabled={!editable}
                      className="glass-input h-9 text-right tabular-nums"
                      data-testid={`ds-ch-gross-${c.channel}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number" min="0" value={c.discount}
                      onChange={e => setChannelVal(i, "discount", e.target.value)}
                      disabled={!editable}
                      className="glass-input h-9 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {fmtRp(c.net || 0)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRp(grossTotal)}</td>
                <td></td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRp(netTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue buckets + Tax/SC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold">Revenue Bucket (untuk PL)</h3>
          {form.revenue_buckets.map((b, i) => (
            <div key={b.bucket} className="flex items-center gap-3">
              <div className="w-24 text-sm text-muted-foreground capitalize">{b.label}</div>
              <Input
                type="number" min="0" value={b.amount}
                onChange={e => setBucketVal(i, e.target.value)}
                disabled={!editable}
                className="glass-input h-9 text-right tabular-nums"
                data-testid={`ds-bucket-${b.bucket}`}
              />
            </div>
          ))}
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
            Revenue total: <span className="font-medium tabular-nums">{fmtRp(revenueTotal)}</span>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold">Service Charge &amp; Tax</h3>
          <div className="flex items-center gap-3">
            <div className="w-24 text-sm text-muted-foreground">Service Chg</div>
            <Input
              type="number" min="0" value={form.service_charge}
              onChange={e => setForm(f => ({ ...f, service_charge: e.target.value }))}
              disabled={!editable}
              className="glass-input h-9 text-right tabular-nums"
              data-testid="ds-sc"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 text-sm text-muted-foreground">Tax (PB1)</div>
            <Input
              type="number" min="0" value={form.tax_amount}
              onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))}
              disabled={!editable}
              className="glass-input h-9 text-right tabular-nums"
              data-testid="ds-tax"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 text-sm text-muted-foreground">Trx Count</div>
            <Input
              type="number" min="0" value={form.transaction_count}
              onChange={e => setForm(f => ({ ...f, transaction_count: e.target.value }))}
              disabled={!editable}
              className="glass-input h-9 text-right tabular-nums"
              data-testid="ds-trx-count"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-sm font-semibold">Grand Total</span>
            <span className="text-xl font-bold tabular-nums">{fmtRp(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Payment breakdown */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Payment Breakdown</h3>
          <Button onClick={addPayment} disabled={!editable} variant="outline" size="sm" className="rounded-full gap-1" data-testid="ds-pay-add">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </div>
        {form.payment_breakdown.length === 0 && (
          <div className="text-sm text-muted-foreground italic">Tambahkan minimal satu metode pembayaran.</div>
        )}
        {form.payment_breakdown.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <select
              value={p.payment_method_id}
              onChange={e => setPaymentVal(i, "payment_method_id", e.target.value)}
              disabled={!editable}
              className="glass-input rounded-lg flex-1 px-3 h-9 text-sm"
              data-testid={`ds-pay-method-${i}`}
            >
              <option value="">-- pilih metode --</option>
              {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
            </select>
            <Input
              type="number" min="0" value={p.amount}
              onChange={e => setPaymentVal(i, "amount", e.target.value)}
              disabled={!editable}
              className="glass-input h-9 text-right tabular-nums w-40"
              data-testid={`ds-pay-amt-${i}`}
            />
            <button onClick={() => removePayment(i)} disabled={!editable} className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className={cn(
          "flex items-center justify-between pt-2 border-t border-border/50 text-sm",
          balanced ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
        )}>
          <span className="flex items-center gap-1.5 font-medium">
            {balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            Total Pembayaran
          </span>
          <span className="font-bold tabular-nums">
            {fmtRp(paymentTotal)} {balanced ? "" : `(Δ ${fmtRp(grandTotal - paymentTotal)})`}
          </span>
        </div>
      </div>

      {/* Notes */}
      <div className="glass-card p-5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Catatan</Label>
        <Textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          disabled={!editable}
          placeholder="Catatan operasional, anomali, dll."
          className="glass-input mt-1 min-h-[80px]"
          data-testid="ds-notes"
        />
      </div>
    </div>
  );
}

function mergeChannels(savedChannels, defaults) {
  const map = Object.fromEntries(savedChannels.map(c => [c.channel, c]));
  return defaults.map(d => ({
    ...d, ...map[d.channel],
    gross: map[d.channel]?.gross ?? 0,
    discount: map[d.channel]?.discount ?? 0,
    net: map[d.channel]?.net ?? 0,
  }));
}
function mergeBuckets(saved, defaults) {
  const map = Object.fromEntries(saved.map(b => [b.bucket, b]));
  return defaults.map(d => ({ ...d, amount: map[d.bucket]?.amount ?? 0 }));
}
