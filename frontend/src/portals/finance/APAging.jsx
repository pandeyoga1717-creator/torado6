/** AP Aging report by vendor with bucket breakdown. */
import { useEffect, useMemo, useState } from "react";
import { Receipt, ChevronDown, ChevronRight, Download } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function APAging() {
  const [asOf, setAsOf] = useState(todayJakartaISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/ap-aging", { params: { as_of: asOf } });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal load AP aging");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [asOf]);

  function toggle(id) {
    setExpanded(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exportCsv() {
    if (!data) return;
    const header = "Vendor,Current,1-30,31-60,61-90,90+,Total";
    const rows = data.rows.map(r =>
      `"${r.vendor_name}",${r.current},${r.d_30},${r.d_60},${r.d_90},${r.d_90p},${r.total}`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `AP-Aging-${data.as_of}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">As of</Label>
          <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="ap-asof" />
        </div>
        <Button onClick={exportCsv} variant="outline" className="ml-auto rounded-full gap-2 h-10" data-testid="ap-export">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {loading && <LoadingState rows={6} />}
      {!loading && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <BucketCard label="Current" value={data.buckets.current} accent="emerald" />
            <BucketCard label="1-30 hari" value={data.buckets.d_30} accent="sky" />
            <BucketCard label="31-60 hari" value={data.buckets.d_60} accent="amber" />
            <BucketCard label="61-90 hari" value={data.buckets.d_90} accent="orange" />
            <BucketCard label="90+ hari" value={data.buckets.d_90p} accent="red" />
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-border/50">
                  <Th></Th>
                  <Th>Vendor</Th>
                  <Th className="text-right">Current</Th>
                  <Th className="text-right">1-30</Th>
                  <Th className="text-right">31-60</Th>
                  <Th className="text-right">61-90</Th>
                  <Th className="text-right">90+</Th>
                  <Th className="text-right">Total</Th>
                </tr></thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr><td colSpan={8}><EmptyState icon={Receipt} title="Tidak ada AP outstanding" description="Semua GR sudah bayar atau belum ada GR." /></td></tr>
                  )}
                  {data.rows.map(v => (
                    <FragmentRow key={v.vendor_id} v={v} expanded={expanded.has(v.vendor_id)} onToggle={() => toggle(v.vendor_id)} />
                  ))}
                  {data.rows.length > 0 && (
                    <tr className="font-bold border-t-2 border-border/70">
                      <td colSpan={2} className="px-5 py-3">Total</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtRp(data.buckets.current)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtRp(data.buckets.d_30)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtRp(data.buckets.d_60)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtRp(data.buckets.d_90)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtRp(data.buckets.d_90p)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtRp(data.grand_total)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}

function BucketCard({ label, value, accent }) {
  return (
    <div className="glass-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-1 text-${accent}-700 dark:text-${accent}-400`}>{fmtRp(value || 0)}</div>
    </div>
  );
}

function FragmentRow({ v, expanded, onToggle }) {
  return (
    <>
      <tr className="border-b border-border/30 hover:bg-foreground/5 cursor-pointer" onClick={onToggle}>
        <td className="pl-5 pr-1 py-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </td>
        <td className="px-3 py-3 font-medium">{v.vendor_name}</td>
        <td className="px-5 py-3 text-right tabular-nums">{v.current ? fmtRp(v.current) : "—"}</td>
        <td className="px-5 py-3 text-right tabular-nums">{v.d_30 ? fmtRp(v.d_30) : "—"}</td>
        <td className="px-5 py-3 text-right tabular-nums">{v.d_60 ? fmtRp(v.d_60) : "—"}</td>
        <td className="px-5 py-3 text-right tabular-nums">{v.d_90 ? fmtRp(v.d_90) : "—"}</td>
        <td className={cn("px-5 py-3 text-right tabular-nums", v.d_90p ? "text-red-700 dark:text-red-400 font-semibold" : "")}>
          {v.d_90p ? fmtRp(v.d_90p) : "—"}
        </td>
        <td className="px-5 py-3 text-right tabular-nums font-bold">{fmtRp(v.total)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-5 py-2 bg-foreground/5">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted-foreground">
                <th className="px-2 py-1">Doc No</th>
                <th className="px-2 py-1">Invoice</th>
                <th className="px-2 py-1">Receive</th>
                <th className="px-2 py-1">Due</th>
                <th className="px-2 py-1">Overdue</th>
                <th className="px-2 py-1 text-right">Amount</th>
              </tr></thead>
              <tbody>
                {v.items.map((it) => (
                  <tr key={it.gr_id} className="border-t border-border/30">
                    <td className="px-2 py-1 font-mono">{it.doc_no || it.gr_id.slice(0, 8)}</td>
                    <td className="px-2 py-1">{it.invoice_no || "—"}</td>
                    <td className="px-2 py-1">{fmtDate(it.receive_date)}</td>
                    <td className="px-2 py-1">{fmtDate(it.due_date)}</td>
                    <td className={cn("px-2 py-1", it.days_overdue > 0 ? "text-red-700 dark:text-red-400 font-medium" : "")}>
                      {it.days_overdue > 0 ? `+${it.days_overdue} hari` : "—"}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtRp(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
