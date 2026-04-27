/** Vendor Performance Scorecard — ranked vendors by composite score with detail drilldown. */
import { useEffect, useState } from "react";
import { ChevronRight, Award, Clock, TrendingDown, BadgeCheck, Download, AlertCircle } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function scoreColor(score) {
  if (score == null) return "text-muted-foreground";
  if (score >= 85) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 70) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}
function scoreBg(score) {
  if (score == null) return "bg-muted";
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-red-500";
}

export default function VendorScorecard() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/reports/vendor-scorecard", {
        params: { date_from: from, date_to: to, top: 50 },
      });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal load vendor scorecard");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [from, to]); // eslint-disable-line

  async function loadDetail(vendorId) {
    setSelectedVendor(vendorId);
    setDetailLoading(true);
    try {
      const res = await api.get(`/reports/vendor-scorecard/${vendorId}`, {
        params: { date_from: from, date_to: to },
      });
      const d = unwrap(res);
      setDetail(d?.vendors?.[0] || null);
    } catch (e) {
      toast.error("Gagal load detail vendor");
    } finally { setDetailLoading(false); }
  }

  function exportCsv() {
    if (!data?.vendors?.length) return;
    const headers = ["Vendor", "Code", "Spend", "PO", "GR", "OnTime%", "AvgLead(d)", "PriceStability%", "Defect%", "Score"];
    const lines = [headers.join(",")];
    data.vendors.forEach(v => {
      lines.push([
        `"${v.vendor_name}"`, v.vendor_code, v.total_spend, v.po_count, v.gr_count,
        v.on_time_pct ?? "", v.avg_lead_time_days ?? "",
        v.price_stability_pct ?? "", v.defect_rate_pct ?? "",
        v.composite_score ?? "",
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vendor-scorecard-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4" data-testid="vendor-scorecard-page">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Dari</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="glass-input mt-1 h-9 w-[160px]" data-testid="scorecard-from" />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Hingga</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="glass-input mt-1 h-9 w-[160px]" data-testid="scorecard-to" />
        </div>
        <Button onClick={exportCsv} variant="outline" className="ml-auto rounded-full gap-2 h-10"
          data-testid="scorecard-export">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {loading && <LoadingState rows={5} />}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={Award} label="Vendors" value={fmtNumber(data.summary.vendor_count)} sub="dievaluasi" />
            <SummaryCard icon={BadgeCheck} label="Total Spend" value={fmtRp(data.summary.total_spend)} sub="periode terpilih" />
            <SummaryCard icon={Clock} label="Avg On-Time" value={`${data.summary.avg_on_time_pct ?? "-"}%`} sub="rata-rata pengiriman" />
            <SummaryCard icon={AlertCircle} label="Vendor Grade A" value={fmtNumber(data.vendors.filter(v => (v.composite_score ?? 0) >= 85).length)} sub="≥ 85 score" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Vendor list */}
            <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
                <h3 className="font-semibold">Vendor Ranking</h3>
                <span className="text-xs text-muted-foreground">{data.vendors.length} vendor</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Vendor</th>
                      <th className="px-3 py-2 text-right">Spend</th>
                      <th className="px-3 py-2 text-right">On-Time</th>
                      <th className="px-3 py-2 text-right">Lead (d)</th>
                      <th className="px-3 py-2 text-right">Defect</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vendors.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">
                        Belum ada data PO/GR pada rentang ini
                      </td></tr>
                    )}
                    {data.vendors.map((v, i) => (
                      <tr key={v.vendor_id}
                        className={cn("border-b border-border/20 hover:bg-muted/20 cursor-pointer transition-colors",
                          selectedVendor === v.vendor_id && "bg-muted/30")}
                        onClick={() => loadDetail(v.vendor_id)}
                        data-testid={`scorecard-row-${v.vendor_code || v.vendor_id}`}>
                        <td className="px-3 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{v.vendor_name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{v.vendor_code}</div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium">{fmtRp(v.total_spend)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{v.on_time_pct ?? "-"}%</td>
                        <td className="px-3 py-3 text-right tabular-nums">{v.avg_lead_time_days ?? "-"}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{v.defect_rate_pct ?? "-"}%</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={cn("h-full", scoreBg(v.composite_score))}
                                style={{ width: `${v.composite_score ?? 0}%` }} />
                            </div>
                            <span className={cn("font-bold tabular-nums", scoreColor(v.composite_score))}>
                              {v.composite_score ?? "-"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detail panel */}
            <div className="glass-card p-5 sticky top-4 self-start">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Award className="h-4 w-4" /> Detail Vendor
              </h3>
              {!detail && !detailLoading && (
                <div className="text-sm text-muted-foreground italic">
                  Klik vendor di tabel untuk melihat detail PO breakdown.
                </div>
              )}
              {detailLoading && <LoadingState rows={3} />}
              {detail && !detailLoading && (
                <div className="space-y-3" data-testid="scorecard-detail">
                  <div>
                    <div className="text-xs text-muted-foreground">{detail.vendor_code}</div>
                    <div className="font-bold">{detail.vendor_name}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Composite" value={detail.composite_score} suffix="/100" big highlight={scoreColor(detail.composite_score)} />
                    <Metric label="Spend" value={fmtRp(detail.total_spend)} big />
                    <Metric label="On-Time %" value={detail.on_time_pct ?? "-"} suffix={detail.on_time_pct != null ? "%" : ""} />
                    <Metric label="Lead Time" value={detail.avg_lead_time_days ?? "-"} suffix={detail.avg_lead_time_days != null ? " hari" : ""} />
                    <Metric label="Price Stab." value={detail.price_stability_pct ?? "-"} suffix={detail.price_stability_pct != null ? "%" : ""} />
                    <Metric label="Defect Rate" value={detail.defect_rate_pct ?? "-"} suffix={detail.defect_rate_pct != null ? "%" : ""} />
                  </div>
                  {detail.po_breakdown?.length > 0 && (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 mt-3">
                        Recent POs ({detail.po_breakdown.length})
                      </div>
                      <div className="max-h-[260px] overflow-y-auto space-y-1.5">
                        {detail.po_breakdown.slice(0, 12).map(po => (
                          <div key={po.po_id} className="text-xs px-2 py-1.5 rounded bg-muted/30 flex items-center justify-between">
                            <div>
                              <div className="font-mono">{po.doc_no}</div>
                              <div className="text-[10px] text-muted-foreground">{po.order_date}</div>
                            </div>
                            <div className="text-right">
                              <div className="tabular-nums font-medium">{fmtRp(po.grand_total)}</div>
                              <div className="text-[10px]">
                                {po.on_time === true && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 h-4 text-[9px] px-1.5">on-time</Badge>}
                                {po.on_time === false && <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-0 h-4 text-[9px] px-1.5">late</Badge>}
                                {po.on_time === null && <Badge className="bg-muted text-muted-foreground border-0 h-4 text-[9px] px-1.5">no GR</Badge>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Metric({ label, value, suffix = "", big, highlight }) {
  return (
    <div className="rounded-lg bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(big ? "text-base font-bold" : "text-sm font-semibold", "tabular-nums", highlight)}>
        {value}{suffix}
      </div>
    </div>
  );
}
