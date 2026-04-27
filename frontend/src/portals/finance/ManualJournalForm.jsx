/** Manual Journal Form — free-form line editor with COA picker, balance check, dim outlet/brand. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ForecastGuardBanner from "@/components/shared/ForecastGuardBanner";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ManualJournalForm() {
  const navigate = useNavigate();
  const [coas, setCoas] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [saving, setSaving] = useState(false);
  const [guardVerdict, setGuardVerdict] = useState(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [form, setForm] = useState({
    entry_date: todayJakartaISO(),
    description: "",
    lines: [
      { coa_id: "", dr: 0, cr: 0, memo: "", dim_outlet: "", dim_brand: "" },
      { coa_id: "", dr: 0, cr: 0, memo: "", dim_outlet: "", dim_brand: "" },
    ],
  });

  useEffect(() => {
    Promise.all([
      api.get("/master/chart-of-accounts", { params: { per_page: 100 } }),
      api.get("/master/outlets", { params: { per_page: 100 } }),
      api.get("/master/brands", { params: { per_page: 100 } }),
    ]).then(([c, o, b]) => {
      setCoas((unwrap(c) || []).filter(x => x.is_postable && x.active));
      setOutlets(unwrap(o) || []);
      setBrands(unwrap(b) || []);
    }).catch(() => {});
  }, []);

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({
      ...f,
      lines: [...f.lines, { coa_id: "", dr: 0, cr: 0, memo: "", dim_outlet: "", dim_brand: "" }],
    }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  const totals = useMemo(() => {
    const dr = form.lines.reduce((s, l) => s + Number(l.dr || 0), 0);
    const cr = form.lines.reduce((s, l) => s + Number(l.cr || 0), 0);
    return { dr, cr, balanced: Math.abs(dr - cr) < 0.5 && dr > 0 };
  }, [form.lines]);

  // Aggregate Dr lines on expense/cogs COA per outlet for forecast guard
  const guardScopes = useMemo(() => {
    const map = new Map();
    form.lines.forEach(l => {
      const dr = Number(l.dr || 0);
      if (dr <= 0) return;
      if (!l.coa_id) return;
      const coa = coas.find(c => c.id === l.coa_id);
      if (!coa) return;
      if (!["expense", "cogs"].includes(coa.type)) return;
      const key = `${l.dim_outlet || "_"}|${l.dim_brand || "_"}`;
      if (!map.has(key)) {
        map.set(key, {
          outletId: l.dim_outlet || null,
          brandId: l.dim_brand || null,
          amount: 0,
          coaCodes: new Set(),
        });
      }
      const e = map.get(key);
      e.amount += dr;
      e.coaCodes.add(coa.code);
    });
    return Array.from(map.values()).map(e => ({
      ...e, coaCodes: Array.from(e.coaCodes),
    }));
  }, [form.lines, coas]);

  const hasSevereGuard = guardVerdict?.severity === "severe";
  const hasMildGuard = guardVerdict?.severity === "mild";
  const needsReason = hasSevereGuard || hasMildGuard;

  async function save() {
    if (!form.entry_date) { toast.error("Tanggal wajib"); return; }
    if (!form.description.trim()) { toast.error("Deskripsi wajib"); return; }
    if (!totals.balanced) { toast.error("Dr dan Cr harus balance dan > 0"); return; }
    if (form.lines.some(l => !l.coa_id)) { toast.error("Pilih COA untuk setiap line"); return; }
    if (form.lines.some(l => Number(l.dr || 0) > 0 && Number(l.cr || 0) > 0)) {
      toast.error("Satu line hanya boleh berisi Dr ATAU Cr, tidak keduanya"); return;
    }
    if (needsReason && !confirmReason.trim()) {
      toast.error("Pengeluaran melewati forecast — wajib isi alasan/justifikasi");
      return;
    }
    setSaving(true);
    try {
      const finalDesc = needsReason && confirmReason.trim()
        ? `${form.description.trim()} | Forecast guard reason: ${confirmReason.trim()}`
        : form.description.trim();
      const payload = {
        entry_date: form.entry_date,
        description: finalDesc,
        lines: form.lines.map(l => ({
          coa_id: l.coa_id,
          dr: Number(l.dr || 0),
          cr: Number(l.cr || 0),
          memo: l.memo,
          dim_outlet: l.dim_outlet || null,
          dim_brand: l.dim_brand || null,
        })).filter(l => l.dr > 0 || l.cr > 0),
      };
      const res = await api.post("/finance/journals/manual", payload);
      const je = unwrap(res);
      toast.success(`JE ${je.doc_no} dibuat`);
      navigate(`/finance/journals/${je.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal post manual JE");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">Manual Journal Entry</h2>
        <div className="ml-auto">
          <Button onClick={save} disabled={saving || !totals.balanced || (needsReason && !confirmReason.trim())} className="rounded-full pill-active gap-2" data-testid="mje-save">
            <Save className="h-4 w-4" /> {saving ? "…" : (hasSevereGuard ? "Post (with reason)" : "Post JE")}
          </Button>
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Entry Date *</Label>
          <Input type="date" value={form.entry_date}
            onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
            className="glass-input mt-1" data-testid="mje-date" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs uppercase text-muted-foreground">Description *</Label>
          <Input value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="mis. Reklasifikasi expense April 2026"
            className="glass-input mt-1" data-testid="mje-desc" />
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Lines</h3>
          <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1" data-testid="mje-add-line">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th className="min-w-[200px]">COA *</Th>
              <Th className="text-right w-32">Debit</Th>
              <Th className="text-right w-32">Kredit</Th>
              <Th className="min-w-[140px]">Memo</Th>
              <Th className="min-w-[120px]">Outlet</Th>
              <Th className="min-w-[120px]">Brand</Th>
              <Th></Th>
            </tr></thead>
            <tbody>
              {form.lines.map((ln, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="px-3 py-2">
                    <select value={ln.coa_id}
                      onChange={e => setLine(i, "coa_id", e.target.value)}
                      className="glass-input rounded-lg w-full px-3 h-9 text-sm"
                      data-testid={`mje-line-coa-${i}`}>
                      <option value="">-- pilih COA --</option>
                      {coas.map(c => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min="0" value={ln.dr}
                      onChange={e => setLine(i, "dr", e.target.value)}
                      className="glass-input h-9 text-right tabular-nums"
                      data-testid={`mje-line-dr-${i}`} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min="0" value={ln.cr}
                      onChange={e => setLine(i, "cr", e.target.value)}
                      className="glass-input h-9 text-right tabular-nums"
                      data-testid={`mje-line-cr-${i}`} />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={ln.memo}
                      onChange={e => setLine(i, "memo", e.target.value)}
                      placeholder="—"
                      className="glass-input h-9" />
                  </td>
                  <td className="px-3 py-2">
                    <select value={ln.dim_outlet}
                      onChange={e => setLine(i, "dim_outlet", e.target.value)}
                      className="glass-input rounded-lg w-full px-3 h-9 text-sm">
                      <option value="">—</option>
                      {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={ln.dim_brand}
                      onChange={e => setLine(i, "dim_brand", e.target.value)}
                      className="glass-input rounded-lg w-full px-3 h-9 text-sm">
                      <option value="">—</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removeLine(i)} disabled={form.lines.length <= 2} className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center disabled:opacity-30">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="px-3 py-3 text-right">Total</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmtRp(totals.dr)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmtRp(totals.cr)}</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>
        <div className={cn(
          "mt-3 flex items-center gap-2 text-sm",
          totals.balanced ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
        )}>
          {totals.balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="font-medium">
            {totals.balanced
              ? "Balance — siap di-post"
              : `Belum balance (Δ ${fmtRp(totals.dr - totals.cr)}). Total Dr harus sama dengan Cr dan > 0.`}
          </span>
        </div>
      </div>

      {/* Forecast Guard banners — one per (outlet, brand) scope of expense Dr */}
      {guardScopes.length > 0 && (
        <div className="space-y-2">
          {guardScopes.map((s, i) => (
            <div key={`guard-${i}-${s.outletId || "_"}-${s.brandId || "_"}`}>
              {(s.outletId || s.brandId) && (
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 ml-1">
                  Scope: {s.outletId ? outlets.find(o => o.id === s.outletId)?.name || "Outlet" : ""}
                  {s.outletId && s.brandId ? " · " : ""}
                  {s.brandId ? brands.find(b => b.id === s.brandId)?.name || "Brand" : ""}
                  {" "}— Expense Dr {fmtRp(s.amount)} ({s.coaCodes.join(", ")})
                </div>
              )}
              <ForecastGuardBanner
                amount={s.amount}
                outletId={s.outletId}
                brandId={s.brandId}
                kind="expense"
                period={form.entry_date?.slice(0, 7)}
                onChange={i === 0 ? setGuardVerdict : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* Reason input shown when guard triggered */}
      {needsReason && (
        <div className={cn(
          "glass-card p-4 border-2",
          hasSevereGuard ? "border-red-500/40" : "border-amber-500/40",
        )}>
          <Label className="text-xs uppercase text-muted-foreground font-semibold">
            Alasan / Justifikasi (wajib karena {hasSevereGuard ? "jauh" : ""} di atas forecast)
          </Label>
          <Textarea
            value={confirmReason}
            onChange={e => setConfirmReason(e.target.value)}
            placeholder="mis. One-off renovasi outlet, bayar deposit vendor baru, koreksi periode lalu, dll."
            className="glass-input mt-1 min-h-[60px]"
            data-testid="mje-guard-reason"
          />
          <div className="text-[11px] text-muted-foreground mt-1.5">
            Alasan ini akan digabung ke description JE untuk audit trail.
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
