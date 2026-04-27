/** Report Builder lite — pick dimensions × metrics × filters, run, save. */
import { useEffect, useState } from "react";
import { Play, Save, Download, Trash2, FilePlus2, FolderOpen } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtNumber, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ReportBuilder() {
  const [catalog, setCatalog] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [dimensions, setDimensions] = useState(["outlet"]);
  const [metrics, setMetrics] = useState(["sales", "gross_profit"]);
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(todayJakartaISO());
  const [outletIds, setOutletIds] = useState([]);
  const [brandIds, setBrandIds] = useState([]);
  const [vendorIds, setVendorIds] = useState([]);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const [savedList, setSavedList] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Load catalog + masters on mount
  useEffect(() => {
    Promise.all([
      api.get("/reports/catalog").then(r => setCatalog(unwrap(r))),
      api.get("/master/outlets", { params: { per_page: 100 } }).then(r => setOutlets(unwrap(r) || [])),
      api.get("/master/brands", { params: { per_page: 100 } }).then(r => setBrands(unwrap(r) || [])),
      api.get("/master/vendors", { params: { per_page: 100 } }).then(r => setVendors(unwrap(r) || [])),
    ]).catch(() => {});
    loadSaved();
  }, []);

  async function loadSaved() {
    try {
      const r = await api.get("/reports/saved");
      setSavedList(unwrap(r) || []);
    } catch { /* noop */ }
  }

  function toggleArr(arr, setArr, val) {
    if (arr.includes(val)) setArr(arr.filter(x => x !== val));
    else setArr([...arr, val]);
  }

  async function run() {
    if (dimensions.length === 0) { toast.error("Pilih minimal 1 dimensi"); return; }
    if (metrics.length === 0) { toast.error("Pilih minimal 1 metrik"); return; }
    setRunning(true);
    try {
      const payload = {
        dimensions, metrics,
        period_from: periodFrom, period_to: periodTo,
        outlet_ids: outletIds.length ? outletIds : null,
        brand_ids: brandIds.length ? brandIds : null,
        vendor_ids: vendorIds.length ? vendorIds : null,
        limit: 200,
      };
      const r = await api.post("/reports/builder/run", payload);
      setResult(unwrap(r));
    } catch (e) {
      toast.error("Gagal menjalankan report: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setRunning(false); }
  }

  async function saveReport() {
    if (!saveName.trim()) { toast.error("Nama wajib"); return; }
    try {
      await api.post("/reports/saved", {
        name: saveName.trim(),
        config: {
          type: "builder",
          dimensions, metrics,
          period_from: periodFrom, period_to: periodTo,
          outlet_ids: outletIds, brand_ids: brandIds, vendor_ids: vendorIds,
        },
      });
      toast.success("Report tersimpan");
      setSaveOpen(false); setSaveName("");
      loadSaved();
    } catch (e) {
      toast.error("Gagal menyimpan: " + (e.response?.data?.errors?.[0]?.message || e.message));
    }
  }

  function loadSavedConfig(s) {
    const c = s.config || {};
    setDimensions(c.dimensions || []);
    setMetrics(c.metrics || []);
    setPeriodFrom(c.period_from || periodFrom);
    setPeriodTo(c.period_to || periodTo);
    setOutletIds(c.outlet_ids || []);
    setBrandIds(c.brand_ids || []);
    setVendorIds(c.vendor_ids || []);
    toast.success(`Loaded: ${s.name}`);
  }

  async function deleteSaved(id) {
    if (!window.confirm("Hapus saved report?")) return;
    try {
      await api.delete(`/reports/saved/${id}`);
      loadSaved();
      toast.success("Dihapus");
    } catch { toast.error("Gagal hapus"); }
  }

  function exportCsv() {
    if (!result?.rows?.length) return;
    const dimCols = dimensions.map(d => `dim_${d}`);
    const headers = [...dimensions, ...metrics];
    const lines = [headers.join(",")];
    result.rows.forEach(r => {
      lines.push([
        ...dimCols.map(c => `"${(r[c] || "").toString().replace(/"/g, '""')}"`),
        ...metrics.map(m => r[m] ?? 0),
      ].join(","));
    });
    lines.push([...dimensions.map(() => ""), ...metrics.map(m => result.totals[m] ?? 0)].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `builder-${periodFrom}_${periodTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!catalog) return <LoadingState rows={3} />;

  return (
    <div className="space-y-4" data-testid="report-builder-page">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-semibold mb-3">1. Dimensi (group by)</h3>
            <div className="flex flex-wrap gap-2">
              {catalog.dimensions.map(d => (
                <button key={d.key} onClick={() => toggleArr(dimensions, setDimensions, d.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-colors border",
                    dimensions.includes(d.key)
                      ? "grad-aurora-soft border-transparent text-foreground font-semibold"
                      : "border-border/40 text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`builder-dim-${d.key}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-semibold mb-3">2. Metrik (kolom)</h3>
            <div className="flex flex-wrap gap-2">
              {catalog.metrics.map(m => (
                <button key={m.key} onClick={() => toggleArr(metrics, setMetrics, m.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-colors border text-left",
                    metrics.includes(m.key)
                      ? "grad-aurora-soft border-transparent text-foreground font-semibold"
                      : "border-border/40 text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`builder-metric-${m.key}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-semibold mb-3">3. Filter</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Dari</Label>
                <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
                  className="glass-input mt-1 h-9" data-testid="builder-from" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Hingga</Label>
                <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
                  className="glass-input mt-1 h-9" data-testid="builder-to" />
              </div>
            </div>
            <FilterRow label="Outlet" items={outlets} selected={outletIds} setSelected={setOutletIds} testid="builder-outlet" />
            <FilterRow label="Brand" items={brands} selected={brandIds} setSelected={setBrandIds} testid="builder-brand" />
            <FilterRow label="Vendor" items={vendors} selected={vendorIds} setSelected={setVendorIds} testid="builder-vendor" />
          </div>

          <div className="flex gap-2 sticky bottom-2 z-10">
            <Button onClick={run} disabled={running} className="rounded-full grad-aurora text-white gap-2 h-10 flex-1"
              data-testid="builder-run">
              <Play className="h-4 w-4" /> {running ? "Running..." : "Run Report"}
            </Button>
            <Button onClick={() => setSaveOpen(!saveOpen)} variant="outline" className="rounded-full gap-2 h-10"
              data-testid="builder-save-toggle">
              <Save className="h-4 w-4" /> Save
            </Button>
            <Button onClick={exportCsv} variant="outline" className="rounded-full gap-2 h-10" disabled={!result}
              data-testid="builder-export">
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
          {saveOpen && (
            <div className="glass-card p-4 flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Nama Report</Label>
                <Input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="contoh: Sales Q1 by Outlet"
                  className="glass-input mt-1 h-9" data-testid="builder-save-name" />
              </div>
              <Button onClick={saveReport} className="rounded-full grad-aurora text-white" data-testid="builder-save-confirm">Simpan</Button>
            </div>
          )}
        </div>

        {/* Saved reports */}
        <div className="glass-card p-5 self-start sticky top-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> Saved Reports
          </h3>
          {savedList.length === 0 && (
            <div className="text-sm text-muted-foreground italic">Belum ada saved report</div>
          )}
          <div className="space-y-1.5">
            {savedList.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                <button onClick={() => loadSavedConfig(s)} className="flex-1 text-left"
                  data-testid={`saved-load-${s.id}`}>
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  {s.description && <div className="text-[11px] text-muted-foreground truncate">{s.description}</div>}
                </button>
                <button onClick={() => deleteSaved(s.id)} className="text-muted-foreground hover:text-red-600 p-1"
                  data-testid={`saved-delete-${s.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="glass-card p-0 overflow-hidden" data-testid="builder-result">
          <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
            <h3 className="font-semibold">Hasil ({result.row_count} baris)</h3>
            <div className="flex gap-2 flex-wrap">
              {metrics.map(m => (
                <Badge key={m} className="bg-muted/40 text-foreground border-0">
                  Σ {m}: <span className="font-bold ml-1">{m === "transaction_count" ? fmtNumber(result.totals[m]) : fmtRp(result.totals[m])}</span>
                </Badge>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {dimensions.map(d => (
                    <th key={d} className="px-3 py-2 text-left">{d}</th>
                  ))}
                  {metrics.map(m => (
                    <th key={m} className="px-3 py-2 text-right">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 && (
                  <tr><td colSpan={dimensions.length + metrics.length}
                    className="text-center py-8 text-muted-foreground italic">
                    Tidak ada data untuk filter ini
                  </td></tr>
                )}
                {result.rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                    {dimensions.map(d => (
                      <td key={d} className="px-3 py-2 font-medium">{r[`dim_${d}`]}</td>
                    ))}
                    {metrics.map(m => (
                      <td key={m} className="px-3 py-2 text-right tabular-nums">
                        {m === "transaction_count" || m === "po_count" || m === "gr_count"
                          ? fmtNumber(r[m]) : fmtRp(r[m])}
                      </td>
                    ))}
                  </tr>
                ))}
                {result.rows.length > 0 && (
                  <tr className="bg-muted/30 font-bold border-t-2 border-border">
                    <td colSpan={dimensions.length} className="px-3 py-2">Total</td>
                    {metrics.map(m => (
                      <td key={m} className="px-3 py-2 text-right tabular-nums">
                        {m === "transaction_count" || m === "po_count" || m === "gr_count"
                          ? fmtNumber(result.totals[m]) : fmtRp(result.totals[m])}
                      </td>
                    ))}
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

function FilterRow({ label, items, selected, setSelected, testid }) {
  if (!items?.length) return null;
  return (
    <div className="mb-3">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5 block">
        {label} {selected.length > 0 && <span className="text-foreground">({selected.length})</span>}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {items.map(it => (
          <button key={it.id} onClick={() => {
            if (selected.includes(it.id)) setSelected(selected.filter(x => x !== it.id));
            else setSelected([...selected, it.id]);
          }}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              selected.includes(it.id)
                ? "bg-foreground text-background border-foreground"
                : "border-border/40 text-muted-foreground hover:text-foreground",
            )}
            data-testid={`${testid}-${it.code || it.id}`}>
            {it.name}
          </button>
        ))}
      </div>
    </div>
  );
}
