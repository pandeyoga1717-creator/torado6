/** Opname Session — active counting form. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Send, Search, AlertTriangle } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtNumber, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function OpnameSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [sess, setSess] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState({}); // { item_id: { counted_qty, notes } }

  async function load() {
    setLoading(true);
    try {
      const [list, o] = await Promise.all([
        api.get("/inventory/opname", { params: { per_page: 50 } }),
        api.get("/master/outlets", { params: { per_page: 100 } }),
      ]);
      setOutlets(unwrap(o) || []);
      const found = (unwrap(list) || []).find(x => x.id === id);
      setSess(found || null);
      // pre-fill counts from existing
      const init = {};
      (found?.lines || []).forEach(ln => {
        if (ln.counted_qty != null) {
          init[ln.item_id] = { counted_qty: ln.counted_qty, notes: ln.notes || "" };
        }
      });
      setCounts(init);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!sess) return [];
    const lines = sess.lines || [];
    if (!q) return lines;
    const s = q.toLowerCase();
    return lines.filter(ln => (ln.item_name || "").toLowerCase().includes(s));
  }, [sess, q]);

  function setCount(itemId, val) {
    setCounts(c => ({ ...c, [itemId]: { ...(c[itemId] || {}), counted_qty: val } }));
  }
  function setNote(itemId, val) {
    setCounts(c => ({ ...c, [itemId]: { ...(c[itemId] || {}), notes: val } }));
  }

  async function saveProgress() {
    if (!sess) return;
    const updates = Object.entries(counts)
      .filter(([_, v]) => v.counted_qty !== "" && v.counted_qty != null)
      .map(([item_id, v]) => ({
        item_id,
        counted_qty: Number(v.counted_qty),
        notes: v.notes,
      }));
    if (updates.length === 0) { toast.info("Belum ada perubahan"); return; }
    setSaving(true);
    try {
      const res = await api.patch(`/inventory/opname/${id}/lines`, { lines: updates });
      setSess(unwrap(res));
      toast.success("Progress disimpan");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
    } finally { setSaving(false); }
  }

  async function submitOpname() {
    if (!confirm("Submit opname? Variance akan diposting ke movements & jurnal.")) return;
    setSubmitting(true);
    try {
      // Save current counts first
      await saveProgress();
      await api.post(`/inventory/opname/${id}/submit`);
      toast.success("Opname disubmit");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
    } finally { setSubmitting(false); }
  }

  if (loading) return <LoadingState rows={8} />;
  if (!sess) return <div className="glass-card p-6 text-center">Sesi tidak ditemukan</div>;

  const outletName = outlets.find(o => o.id === sess.outlet_id)?.name || sess.outlet_id;
  const editable = sess.status === "in_progress" && can("outlet.opname.execute");

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate("/inventory/opname")} className="rounded-full gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">Opname {sess.doc_no || sess.id.slice(0, 8)}</h2>
        <StatusPill status={sess.status} />
        <div className="ml-auto flex items-center gap-2">
          {editable && (
            <>
              <Button onClick={saveProgress} disabled={saving} variant="outline" className="rounded-full gap-2" data-testid="opn-save">
                <Save className="h-4 w-4" /> {saving ? "…" : "Simpan Progress"}
              </Button>
              <Button onClick={submitOpname} disabled={submitting} className="rounded-full pill-active gap-2" data-testid="opn-submit">
                <Send className="h-4 w-4" /> {submitting ? "…" : "Submit"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <Field label="Outlet" value={outletName} />
        <Field label="Tanggal" value={fmtDate(sess.opname_date)} />
        <Field label="Period" value={sess.period} />
        <Field label="Counted" value={`${sess.counted_items || 0}/${sess.total_items || 0}`} />
        <Field label="Variance Value" value={
          <span className={sess.total_variance_value < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}>
            {fmtRp(sess.total_variance_value || 0)}
          </span>
        } />
      </div>

      <div className="glass-card p-3 flex items-center gap-3">
        <Search className="h-4 w-4 text-muted-foreground ml-2" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari item…" className="glass-input flex-1" data-testid="opn-search" />
        <span className="text-xs text-muted-foreground pr-2">Total {filtered.length} item</span>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Item</Th>
              <Th className="text-right">Sistem</Th>
              <Th className="text-right">Counted</Th>
              <Th className="text-right">Variance</Th>
              <Th className="text-right">Variance Value</Th>
              <Th>Note</Th>
            </tr></thead>
            <tbody>
              {filtered.map(ln => {
                const cur = counts[ln.item_id]?.counted_qty;
                const counted = cur !== "" && cur != null ? Number(cur) : null;
                const variance = counted != null ? counted - Number(ln.system_qty || 0) : null;
                const varValue = variance != null ? variance * Number(ln.unit_cost || 0) : 0;
                return (
                  <tr key={ln.item_id} className="border-b border-border/30 hover:bg-foreground/5">
                    <td className="px-5 py-2">
                      <div className="font-medium">{ln.item_name}</div>
                      <div className="text-xs text-muted-foreground">{ln.unit} · cost {fmtRp(ln.unit_cost || 0)}</div>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">{fmtNumber(ln.system_qty || 0, 2)}</td>
                    <td className="px-5 py-2 text-right">
                      <Input
                        type="number" step="0.01"
                        value={cur ?? ""}
                        onChange={e => setCount(ln.item_id, e.target.value)}
                        disabled={!editable}
                        placeholder="—"
                        className="glass-input h-9 w-28 text-right tabular-nums ml-auto"
                        data-testid={`opn-count-${ln.item_id}`}
                      />
                    </td>
                    <td className={cn("px-5 py-2 text-right tabular-nums font-semibold",
                      variance == null ? "text-muted-foreground" :
                        variance < 0 ? "text-red-700 dark:text-red-400" :
                        variance > 0 ? "text-emerald-700 dark:text-emerald-400" : "")}>
                      {variance == null ? "—" : `${variance > 0 ? "+" : ""}${fmtNumber(variance, 2)}`}
                    </td>
                    <td className={cn("px-5 py-2 text-right tabular-nums",
                      variance != null && variance < 0 ? "text-red-700 dark:text-red-400" : "")}>
                      {variance != null && variance !== 0 ? fmtRp(varValue) : "—"}
                    </td>
                    <td className="px-5 py-2">
                      <Input value={counts[ln.item_id]?.notes ?? ln.notes ?? ""}
                        onChange={e => setNote(ln.item_id, e.target.value)}
                        disabled={!editable}
                        placeholder="—" className="glass-input h-9" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sess.status !== "in_progress" && (
        <div className="glass-card p-4 border-l-4 border-emerald-500 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Sesi opname ini sudah {sess.status}. Tidak bisa diedit lagi.
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
