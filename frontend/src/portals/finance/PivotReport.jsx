/** Pivot — 2D matrix with cell heat-map + row/col totals + CSV export. */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtNumber, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PivotReport() {
  const [catalog, setCatalog] = useState(null);
  const [dimX, setDimX] = useState("month");
  const [dimY, setDimY] = useState("outlet");
  const [metric, setMetric] = useState("sales");
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(todayJakartaISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/reports/catalog").then(r => setCatalog(unwrap(r))).catch(() => {});
  }, []);

  async function load() {
    if (dimX === dimY) { toast.error("Dim X & Y harus berbeda"); return; }
    setLoading(true);
    try {
      const r = await api.get("/reports/pivot", {
        params: { dim_x: dimX, dim_y: dimY, metric, period_from: periodFrom, period_to: periodTo },
      });
      setData(unwrap(r));
    } catch (e) {
      toast.error("Gagal load pivot: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setLoading(false); }
  }
  useEffect(() => { if (catalog) load(); }, [dimX, dimY, metric, periodFrom, periodTo, catalog]); // eslint-disable-line

  function exportCsv() {
    if (!data) return;
    const lines = [`${dimY}\\${dimX},${data.x_labels.join(",")},Total`];
    data.y_labels.forEach((yl, i) => {
      lines.push([`"${yl}"`, ...data.cells[i], data.row_totals[i]].join(","));
    });
    lines.push(["Total", ...data.col_totals, data.grand_total].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pivot-${dimY}_x_${dimX}-${metric}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Find cell max for heatmap intensity
  const maxCell = data ? Math.max(1, ...data.cells.flat()) : 1;

  if (!catalog) return <LoadingState rows={3} />;

  const isCount = metric === "transaction_count" || metric === "po_count" || metric === "gr_count";
  const fmt = isCount ? fmtNumber : fmtRp;

  return (
    <div className="space-y-4" data-testid="pivot-page">
      <div className="glass-card p-4 grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Y-axis (rows)</Label>
          <select value={dimY} onChange={e => setDimY(e.target.value)} className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            data-testid="pivot-dim-y">
            {catalog.dimensions.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">X-axis (cols)</Label>
          <select value={dimX} onChange={e => setDimX(e.target.value)} className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            data-testid="pivot-dim-x">
            {catalog.dimensions.filter(d => d.key !== dimY).map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Metric</Label>
          <select value={metric} onChange={e => setMetric(e.target.value)} className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            data-testid="pivot-metric">
            {catalog.metrics.map(m => <option key={m.key} value={m.key}>{m.key}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Dari</Label>
          <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="pivot-from" />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Hingga</Label>
          <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="pivot-to" />
        </div>
        <Button onClick={exportCsv} variant="outline" className="rounded-full gap-2 h-9 col-span-2 lg:col-span-1 lg:ml-auto"
          disabled={!data} data-testid="pivot-export-csv">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {loading && <LoadingState rows={6} />}

      {!loading && data && (
        <div className="glass-card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold">{dimY} × {dimX} — {metric}</h3>
            <div className="text-sm">
              Total: <span className="font-bold tabular-nums">{fmt(data.grand_total)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left sticky left-0 bg-muted/40 z-10">{dimY} \ {dimX}</th>
                  {data.x_labels.map(xl => (
                    <th key={xl} className="px-3 py-2 text-right whitespace-nowrap">{xl}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.y_labels.length === 0 && (
                  <tr><td colSpan={data.x_labels.length + 2} className="text-center py-8 text-muted-foreground italic">
                    Tidak ada data
                  </td></tr>
                )}
                {data.y_labels.map((yl, ri) => (
                  <tr key={yl} className="border-b border-border/20 hover:bg-muted/10">
                    <td className="px-3 py-2 font-medium sticky left-0 bg-background z-10">{yl}</td>
                    {data.cells[ri].map((v, ci) => {
                      const intensity = maxCell > 0 ? v / maxCell : 0;
                      return (
                        <td key={ci} className="px-3 py-2 text-right tabular-nums relative"
                          data-testid={`pivot-cell-${ri}-${ci}`}>
                          <div className="absolute inset-0 m-0.5 rounded"
                            style={{ background: `rgba(124, 76, 196, ${0.05 + intensity * 0.35})` }} />
                          <span className="relative">{v === 0 ? "—" : fmt(v)}</span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right tabular-nums font-bold bg-muted/20">{fmt(data.row_totals[ri])}</td>
                  </tr>
                ))}
                {data.y_labels.length > 0 && (
                  <tr className="bg-muted/30 font-bold border-t-2 border-border">
                    <td className="px-3 py-2 sticky left-0 bg-muted/40 z-10">Total</td>
                    {data.col_totals.map((c, i) => (
                      <td key={i} className="px-3 py-2 text-right tabular-nums">{fmt(c)}</td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(data.grand_total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
