/** PR Form — create new Purchase Request. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Send, Plus, Trash2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function PRForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    outlet_id: "", brand_id: "", source: "manual",
    request_date: todayJakartaISO(), needed_by: "",
    lines: [{ item_name: "", item_id: null, qty: 1, unit: "pcs", est_cost: 0, notes: "" }],
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      api.get("/master/outlets", { params: { per_page: 100 } }),
      api.get("/master/brands", { params: { per_page: 100 } }),
    ]).then(([o, b]) => {
      setOutlets(unwrap(o) || []);
      setBrands(unwrap(b) || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.outlet_id) return;
    const userOutlets = user?.outlet_ids || [];
    if (userOutlets.length === 1) setForm(f => ({ ...f, outlet_id: userOutlets[0] }));
  }, [user]); // eslint-disable-line

  const userOutlets = useMemo(() => {
    if ((user?.permissions || []).includes("*")) return outlets;
    const ids = new Set(user?.outlet_ids || []);
    return outlets.filter(o => ids.has(o.id));
  }, [outlets, user]);

  const totalEst = form.lines.reduce(
    (s, ln) => s + Number(ln.qty || 0) * Number(ln.est_cost || 0), 0,
  );

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({
      ...f, lines: [...f.lines, { item_name: "", item_id: null, qty: 1, unit: "pcs", est_cost: 0, notes: "" }],
    }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  async function save(submit = false) {
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    if (form.lines.some(l => !l.item_name || !l.qty)) {
      toast.error("Lengkapi semua line item"); return;
    }
    setSaving(true);
    try {
      const payload = {
        outlet_id: form.outlet_id,
        brand_id: form.brand_id || null,
        source: form.source,
        request_date: form.request_date,
        needed_by: form.needed_by || null,
        lines: form.lines.map(l => ({
          item_id: l.item_id, item_name: l.item_name,
          qty: Number(l.qty), unit: l.unit,
          est_cost: Number(l.est_cost || 0), notes: l.notes,
        })),
        notes: form.notes,
        status: submit ? "submitted" : "draft",
      };
      const res = await api.post("/procurement/prs", payload);
      const pr = unwrap(res);
      toast.success(submit ? "PR di-submit" : "Draft PR disimpan");
      navigate(`/procurement/pr/${pr.id}`);
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
        <h2 className="text-xl font-bold">PR Baru</h2>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => save(false)} disabled={saving} variant="outline" className="rounded-full gap-2" data-testid="pr-save-draft">
            <Save className="h-4 w-4" /> Simpan Draft
          </Button>
          <Button onClick={() => save(true)} disabled={saving} className="rounded-full pill-active gap-2" data-testid="pr-submit">
            <Send className="h-4 w-4" /> Submit
          </Button>
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Outlet *</Label>
          <select value={form.outlet_id}
            onChange={e => setForm(f => ({ ...f, outlet_id: e.target.value }))}
            className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
            data-testid="pr-outlet">
            <option value="">-- pilih --</option>
            {userOutlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Brand</Label>
          <select value={form.brand_id}
            onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}
            className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1">
            <option value="">-- (opsional) --</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Source</Label>
          <select value={form.source}
            onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
            className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1">
            <option value="manual">Manual</option>
            <option value="KDO">KDO (Kebutuhan Direksi/Operasional)</option>
            <option value="BDO">BDO (Bahan Direksi/Operasional)</option>
          </select>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Tanggal Request</Label>
          <Input type="date" value={form.request_date}
            onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))}
            className="glass-input mt-1" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Needed By</Label>
          <Input type="date" value={form.needed_by}
            onChange={e => setForm(f => ({ ...f, needed_by: e.target.value }))}
            className="glass-input mt-1" />
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Line Items</h3>
          <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1" data-testid="pr-add-line">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th className="min-w-[200px]">Item</Th>
              <Th className="text-right w-24">Qty</Th>
              <Th className="w-20">Unit</Th>
              <Th className="text-right w-32">Est. Cost</Th>
              <Th className="text-right w-32">Subtotal</Th>
              <Th className="min-w-[200px]">Catatan</Th>
              <Th></Th>
            </tr></thead>
            <tbody>
              {form.lines.map((ln, i) => {
                const subtotal = Number(ln.qty || 0) * Number(ln.est_cost || 0);
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
                              ...lines[i],
                              item_name: it.name, item_id: it.id,
                              unit: it.unit || lines[i].unit,
                              est_cost: it.last_price ?? lines[i].est_cost,
                            };
                            return { ...f, lines };
                          });
                        }}
                        placeholder="Cari item…"
                        dataTestId={`pr-line-item-${i}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" value={ln.qty}
                        onChange={e => setLine(i, "qty", e.target.value)}
                        className="glass-input h-9 text-right tabular-nums"
                        data-testid={`pr-line-qty-${i}`} />
                    </td>
                    <td className="px-3 py-2">
                      <Input value={ln.unit}
                        onChange={e => setLine(i, "unit", e.target.value)}
                        className="glass-input h-9" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" value={ln.est_cost}
                        onChange={e => setLine(i, "est_cost", e.target.value)}
                        className="glass-input h-9 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fmtRp(subtotal)}
                    </td>
                    <td className="px-3 py-2">
                      <Input value={ln.notes || ""}
                        onChange={e => setLine(i, "notes", e.target.value)}
                        className="glass-input h-9" placeholder="—" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeLine(i)} className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td colSpan={4} className="px-3 py-3 text-right">Total Estimasi</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmtRp(totalEst)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
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
