/** Profit & Loss report with prev-period compare. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Download } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SECTION_LABELS = { revenue: "Revenue", cogs: "Cost of Goods Sold (COGS)", expense: "Operating Expenses" };

export default function ProfitLoss() {
  const [period, setPeriod] = useState(() => todayJakartaISO().slice(0, 7));
  const [outletId, setOutletId] = useState("");
  const [outlets, setOutlets] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then(r => setOutlets(unwrap(r) || [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { period, compare_prev: true };
      if (outletId) params.dim_outlet = outletId;
      const res = await api.get("/finance/profit-loss", { params });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal load P&L");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [period, outletId]); // eslint-disable-line

  function exportCsv() {
    if (!data) return;
    const lines = ["Section,Code,Name,Amount"];
    ["revenue", "cogs", "expense"].forEach(sec => {
      (data.sections[sec] || []).forEach(r => {
        lines.push(`${sec},${r.code},"${r.name}",${r.amount}`);
      });
    });
    lines.push(`,,Gross Profit,${data.totals.gross_profit}`);
    lines.push(`,,Net Income,${data.totals.net_income}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `PL-${period}${outletId ? `-${outletId.slice(0, 6)}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Period</Label>
          <Input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="pl-period" />
        </div>
        <div className="min-w-[180px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <select value={outletId} onChange={e => setOutletId(e.target.value)}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="pl-outlet">
            <option value="">Consolidated</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <Button onClick={exportCsv} variant="outline" className="ml-auto rounded-full gap-2 h-10" data-testid="pl-export">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {loading && <LoadingState rows={6} />}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Revenue" value={data.totals.revenue} compare={data.compare?.revenue} positive />
            <SummaryCard label="Gross Profit" value={data.totals.gross_profit} compare={data.compare?.gross_profit} positive
              hint={`Margin ${data.totals.gross_margin_pct}%`} />
            <SummaryCard label="Operating Expense" value={data.totals.expense} compare={data.compare?.expense} positive={false} />
            <SummaryCard label="Net Income" value={data.totals.net_income} compare={data.compare?.net_income} positive
              hint={`Margin ${data.totals.net_margin_pct}%`} />
          </div>

          {["revenue", "cogs", "expense"].map(sec => {
            const items = data.sections[sec] || [];
            const total = items.reduce((s, r) => s + r.amount, 0);
            return (
              <div key={sec} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{SECTION_LABELS[sec]}</h3>
                  <span className="font-bold tabular-nums">{fmtRp(total)}</span>
                </div>
                {items.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">—</div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {items.map(r => (
                        <tr key={r.coa_id} className="border-b border-border/30 last:border-0">
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground w-20">{r.code}</td>
                          <td className="px-3 py-2">
                            <Link to={`/finance/journals?period=${period}&coa_id=${r.coa_id}`} className="hover:text-foreground hover:underline" data-testid={`pl-coa-${r.code}`}>
                              {r.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtRp(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between font-semibold">
              <span>Gross Profit</span>
              <span className="tabular-nums">{fmtRp(data.totals.gross_profit)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Net Income</span>
              <span className="tabular-nums">{fmtRp(data.totals.net_income)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, compare, hint, positive }) {
  const delta = compare != null ? value - compare : null;
  const deltaPct = compare && compare !== 0 ? ((value - compare) / Math.abs(compare)) * 100 : null;
  const goodDirection = positive ? delta >= 0 : delta <= 0;
  return (
    <div className="glass-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{fmtRp(value || 0)}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      {delta != null && (
        <div className={cn("text-xs flex items-center gap-1 mt-1",
          goodDirection ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {deltaPct != null ? `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "—"}
          <span className="text-muted-foreground ml-1">vs prev</span>
        </div>
      )}
    </div>
  );
}
