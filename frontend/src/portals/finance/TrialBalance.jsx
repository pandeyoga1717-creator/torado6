/** Trial Balance — by period, all postable COAs with non-zero activity. */
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Download, Search } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TrialBalance() {
  const [period, setPeriod] = useState(() => todayJakartaISO().slice(0, 7));
  const [outletId, setOutletId] = useState("");
  const [outlets, setOutlets] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then(r => setOutlets(unwrap(r) || [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { period };
      if (outletId) params.dim_outlet = outletId;
      const res = await api.get("/finance/trial-balance", { params });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal load TB");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [period, outletId]); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!q) return data.rows;
    const s = q.toLowerCase();
    return data.rows.filter(r =>
      (r.code || "").toLowerCase().includes(s) ||
      (r.name || "").toLowerCase().includes(s),
    );
  }, [data, q]);

  function exportCsv() {
    if (!data) return;
    const header = "Code,Name,Type,Normal,Opening,Period_Dr,Period_Cr,Closing";
    const rows = data.rows.map(r =>
      `${r.code},"${r.name}",${r.type},${r.normal_balance},${r.opening},${r.period_dr},${r.period_cr},${r.closing}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `TB-${period}${outletId ? `-${outletId.slice(0, 6)}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Period</Label>
          <Input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="tb-period" />
        </div>
        <div className="min-w-[180px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet (opsional)</Label>
          <select value={outletId} onChange={e => setOutletId(e.target.value)}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="tb-outlet">
            <option value="">Consolidated</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Cari COA</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Code / nama akun…" className="glass-input pl-9 h-9" />
          </div>
        </div>
        <Button onClick={exportCsv} variant="outline" className="rounded-full gap-2 h-10" data-testid="tb-export">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {data && (
        <div className={cn(
          "glass-card p-4 flex items-center gap-3 text-sm",
          data.totals.is_balanced_period
            ? "border-l-4 border-emerald-500"
            : "border-l-4 border-amber-500",
        )}>
          {data.totals.is_balanced_period ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <span className="font-medium">
            {data.totals.is_balanced_period
              ? "Period activity balanced (Dr = Cr)."
              : `Period belum balance: Δ ${fmtRp(data.totals.period_dr - data.totals.period_cr)}`}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            Period Dr {fmtRp(data.totals.period_dr)} · Cr {fmtRp(data.totals.period_cr)}
          </span>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Code</Th><Th>Name</Th><Th>Type</Th>
              <Th className="text-right">Opening</Th>
              <Th className="text-right">Period Dr</Th>
              <Th className="text-right">Period Cr</Th>
              <Th className="text-right">Closing</Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-6"><LoadingState rows={8} /></td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7}><EmptyState title="Tidak ada aktivitas" /></td></tr>
              )}
              {!loading && filtered.map(r => (
                <tr key={r.coa_id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-5 py-2">{r.name}</td>
                  <td className="px-5 py-2 text-xs text-muted-foreground capitalize">{r.type}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{fmtRp(r.opening)}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{r.period_dr ? fmtRp(r.period_dr) : "—"}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{r.period_cr ? fmtRp(r.period_cr) : "—"}</td>
                  <td className="px-5 py-2 text-right tabular-nums font-semibold">{fmtRp(r.closing)}</td>
                </tr>
              ))}
              {data && (
                <tr className="font-bold border-t-2 border-border/70">
                  <td colSpan={4} className="px-5 py-3 text-right">Total Period</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtRp(data.totals.period_dr)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtRp(data.totals.period_cr)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
