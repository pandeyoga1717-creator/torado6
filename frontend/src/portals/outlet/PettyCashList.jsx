/** Petty Cash list + balance widget + create dialog with AI GL Suggestion. */
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Wallet, Calendar, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
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
import KpiCard from "@/components/shared/KpiCard";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import VendorAutocomplete from "@/components/shared/VendorAutocomplete";
import GLSuggestion from "@/components/shared/GLSuggestion";
import ReceiptCapture from "@/components/shared/ReceiptCapture";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function PettyCashList() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [coas, setCoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [outletId, setOutletId] = useState("");
  const [balance, setBalance] = useState(0);
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
      api.get("/master/chart-of-accounts", { params: { per_page: 200 } }),
    ]).then(([o, c]) => {
      const outletList = unwrap(o) || [];
      setOutlets(outletList);
      setCoas((unwrap(c) || []).filter(coa => coa.is_postable && coa.active));
      // default outlet
      const ownIds = (user?.permissions || []).includes("*")
        ? outletList.map(x => x.id)
        : (user?.outlet_ids || []);
      if (ownIds.length > 0) setOutletId(ownIds[0]);
    }).catch(() => {});
  }, [user]);

  async function loadList() {
    if (!outletId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [list, bal] = await Promise.all([
        api.get("/outlet/petty-cash", { params: { outlet_id: outletId, page, per_page: 20 } }),
        api.get("/outlet/petty-cash/balance", { params: { outlet_id: outletId } }),
      ]);
      setItems(unwrap(list) || []);
      setMeta(list.data?.meta || {});
      setBalance(unwrap(bal)?.balance || 0);
    } catch (e) {
      toast.error("Gagal load petty cash");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadList(); }, [outletId, page]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      {/* Outlet selector + Balance KPI */}
      <div className="glass-card p-5 flex items-end gap-4 flex-wrap">
        <div className="min-w-[220px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <select
            value={outletId}
            onChange={e => { setOutletId(e.target.value); setPage(1); }}
            className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
            data-testid="pc-outlet"
          >
            <option value="">-- pilih outlet --</option>
            {userOutlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Saldo Petty Cash</Label>
          <div className="glass-input rounded-lg px-4 h-10 mt-1 flex items-center justify-between">
            <span className="font-bold text-lg tabular-nums">{fmtRp(balance)}</span>
            {balance < 500000 && balance > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Saldo Rendah
              </span>
            )}
            {balance >= 500000 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Cukup
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={() => setShowForm(true)} disabled={!outletId}
          className="rounded-full pill-active gap-2 h-10" data-testid="pc-new"
        >
          <Plus className="h-4 w-4" /> Transaksi Baru
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border/50">
                <Th>Tanggal</Th>
                <Th>Type</Th>
                <Th>Deskripsi</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Saldo Setelah</Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="p-6"><LoadingState rows={5} /></td></tr>}
              {!loading && !outletId && <tr><td colSpan={5}><EmptyState title="Pilih outlet untuk melihat petty cash" /></td></tr>}
              {!loading && outletId && items.length === 0 && (
                <tr><td colSpan={5}>
                  <EmptyState
                    icon={Wallet}
                    title="Belum ada transaksi"
                    description="Mulai catat pengeluaran kecil di sini."
                  />
                </td></tr>
              )}
              {!loading && items.map(t => (
                <tr key={t.id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3">{fmtDate(t.txn_date)}</td>
                  <td className="px-5 py-3"><TypePill type={t.type} /></td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{t.description}</div>
                    {(t.item_text || t.vendor_text) && (
                      <div className="text-xs text-muted-foreground">
                        {t.item_text}{t.item_text && t.vendor_text ? " · " : ""}{t.vendor_text}
                      </div>
                    )}
                  </td>
                  <td className={cn("px-5 py-3 text-right tabular-nums font-semibold",
                    (t.type === "replenish" || t.type === "adjustment") ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
                  )}>
                    {(t.type === "replenish" || t.type === "adjustment") ? "+" : "−"} {fmtRp(t.amount || 0)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{fmtRp(t.balance_after || 0)}</td>
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

      <PettyCashForm
        open={showForm} outletId={outletId} coas={coas}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); loadList(); }}
      />
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}

function TypePill({ type }) {
  const map = {
    purchase:    { Icon: ArrowDownCircle, label: "Purchase",   color: "red" },
    replenish:   { Icon: ArrowUpCircle,   label: "Replenish",  color: "emerald" },
    adjustment:  { Icon: ArrowLeftRight,  label: "Adjustment", color: "sky" },
  };
  const cfg = map[type] || map.purchase;
  const Icon = cfg.Icon;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 bg-${cfg.color}-500/15 text-${cfg.color}-700 dark:text-${cfg.color}-400`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function PettyCashForm({ open, outletId, coas, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...emptyForm(), txn_date: todayJakartaISO() });
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!form.description) { toast.error("Deskripsi wajib"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Amount harus > 0"); return; }
    setSaving(true);
    try {
      const payload = {
        outlet_id: outletId,
        txn_date: form.txn_date,
        type: form.type,
        amount: Number(form.amount),
        description: form.description,
        item_text: form.item_text || null,
        item_id: form.item_id || null,
        vendor_text: form.vendor_text || null,
        vendor_id: form.vendor_id || null,
        gl_account_id: form.gl_account_id || null,
        receipt_url: form.receipt_url || null,
        notes: form.notes || null,
      };
      await api.post("/outlet/petty-cash", payload);
      toast.success("Petty cash dicatat");
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
      // Use total as amount when not already filled
      if ((!f.amount || Number(f.amount) === 0) && data.total > 0) {
        next.amount = String(data.total);
      }
      // Build description from vendor + first item if blank
      if (!f.description) {
        const firstItem = data.items?.[0]?.name;
        if (data.vendor_name && firstItem) {
          next.description = `${firstItem} \u2014 ${data.vendor_name}`;
        } else if (firstItem) {
          next.description = firstItem;
        } else if (data.vendor_name) {
          next.description = data.vendor_name;
        }
      }
      // Vendor text if blank
      if (!f.vendor_text && data.vendor_name) {
        next.vendor_text = data.vendor_name;
      }
      // Date if blank or different
      if (data.receipt_date) {
        next.txn_date = data.receipt_date;
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaksi Petty Cash</DialogTitle>
          <DialogDescription>Catat pengeluaran/replenish kas kecil. AI akan membantu kategorisasi GL.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "purchase",   l: "Pengeluaran", Icon: ArrowDownCircle },
              { v: "replenish",  l: "Replenish",   Icon: ArrowUpCircle },
              { v: "adjustment", l: "Adjustment",  Icon: ArrowLeftRight },
            ].map(t => {
              const Icon = t.Icon;
              return (
                <button
                  key={t.v}
                  onClick={() => setForm(f => ({ ...f, type: t.v }))}
                  className={cn(
                    "glass-input rounded-xl px-3 py-2.5 text-sm flex items-center gap-2 transition-colors",
                    form.type === t.v ? "pill-active" : "hover:bg-foreground/5",
                  )}
                  data-testid={`pc-type-${t.v}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.l}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tanggal</Label>
              <Input
                type="date" value={form.txn_date}
                onChange={e => setForm(f => ({ ...f, txn_date: e.target.value }))}
                className="glass-input mt-1" data-testid="pc-date"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Amount *</Label>
              <Input
                type="number" min="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="glass-input mt-1 tabular-nums" data-testid="pc-amount"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Deskripsi *</Label>
            <Input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="mis: Beli galon untuk operational"
              className="glass-input mt-1" data-testid="pc-desc"
            />
          </div>

          {form.type === "purchase" && (
            <>
              <ReceiptCapture
                onExtracted={handleOCRExtracted}
                onImage={(dataUrl) => setForm(f => ({ ...f, receipt_url: dataUrl }))}
                compact
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Item (opsional)</Label>
                  <ItemAutocomplete
                    value={form.item_text}
                    onChange={(v) => setForm(f => ({ ...f, item_text: v, item_id: null }))}
                    onSelect={(it) => setForm(f => ({ ...f, item_text: it.name, item_id: it.id }))}
                    dataTestId="pc-item"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vendor (opsional)</Label>
                  <VendorAutocomplete
                    value={form.vendor_text}
                    onChange={(v) => setForm(f => ({ ...f, vendor_text: v, vendor_id: null }))}
                    onSelect={(v) => setForm(f => ({ ...f, vendor_text: v.name, vendor_id: v.id }))}
                    dataTestId="pc-vendor"
                  />
                </div>
              </div>

              {/* AI GL Suggestion */}
              <GLSuggestion
                description={form.description}
                amount={form.amount}
                outletId={outletId}
                onAccept={(s) => setForm(f => ({ ...f, gl_account_id: s.gl_id }))}
                onLearn={(s) => {
                  if (form.description && s.gl_id) {
                    api.post("/ai/categorize/learn", {
                      description: form.description, gl_account_id: s.gl_id,
                    }).catch(() => {});
                  }
                }}
              />

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">GL Account *</Label>
                <select
                  value={form.gl_account_id}
                  onChange={e => setForm(f => ({ ...f, gl_account_id: e.target.value }))}
                  className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
                  data-testid="pc-gl"
                >
                  <option value="">-- pilih GL --</option>
                  {coas.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="glass-input mt-1 min-h-[60px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="pc-save">
            {saving ? "…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyForm() {
  return {
    type: "purchase",
    txn_date: todayJakartaISO(),
    amount: "",
    description: "",
    item_text: "", item_id: null,
    vendor_text: "", vendor_id: null,
    gl_account_id: "",
    receipt_url: "",
    notes: "",
  };
}
