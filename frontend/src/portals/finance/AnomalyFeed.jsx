/** Phase 7D — Anomaly Feed (Finance).
 * Lists anomaly_events with filter + triage actions + detail drawer.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Clock, XCircle, Play, Flag,
  RefreshCw, Filter, ChevronRight, Search, Shield, Eye,
} from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtRelative, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

const SEVERITY_LABELS = {
  severe: "Severe",
  mild: "Mild",
  none: "None",
};

const STATUS_LABELS = {
  open: "Baru",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  resolved: "Resolved",
  false_positive: "False Positive",
};

function severityStyle(sev) {
  if (sev === "severe") return "bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/30";
  if (sev === "mild") return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30";
}

function statusStyle(st) {
  switch (st) {
    case "open":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
    case "acknowledged":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "investigating":
      return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300";
    case "resolved":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "false_positive":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
    default:
      return "bg-muted";
  }
}

export default function AnomalyFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [types, setTypes] = useState([]);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState(null);
  const [outlets, setOutlets] = useState([]);

  // Filters
  const [fType, setFType] = useState("");
  const [fSeverity, setFSeverity] = useState("");
  const [fStatus, setFStatus] = useState("open");
  const [fOutlet, setFOutlet] = useState("");
  const [fQuery, setFQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/anomalies", {
        params: {
          type: fType || undefined,
          severity: fSeverity || undefined,
          status: fStatus || undefined,
          outlet_id: fOutlet || undefined,
          per_page: 100,
        },
      });
      const data = unwrap(res) || [];
      setItems(data);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load: " + (e?.response?.data?.errors?.[0]?.message || e.message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get("/anomalies/types").then((r) => setTypes(unwrap(r) || [])).catch(() => {});
    api.get("/master/outlets", { params: { per_page: 50 } }).then((r) => setOutlets(unwrap(r) || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [fType, fSeverity, fStatus, fOutlet]); // eslint-disable-line

  // Open detail when ?id= provided
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) {
      setSelected(null);
      return;
    }
    const found = items.find((i) => i.id === id);
    if (found) setSelected(found);
    else {
      api.get(`/anomalies/${id}`).then((r) => setSelected(unwrap(r))).catch(() => setSelected(null));
    }
  }, [searchParams, items]);

  const filteredBySearch = useMemo(() => {
    if (!fQuery.trim()) return items;
    const q = fQuery.toLowerCase();
    return items.filter((i) =>
      (i.title || "").toLowerCase().includes(q)
      || (i.message || "").toLowerCase().includes(q),
    );
  }, [items, fQuery]);

  async function runScan() {
    setScanning(true);
    try {
      const res = await api.post("/anomalies/scan", { days: 14 });
      const data = unwrap(res);
      toast.success(`Scan selesai — ditemukan ${data.counts.total} anomaly`);
      await load();
    } catch (e) {
      toast.error("Scan gagal: " + (e?.response?.data?.errors?.[0]?.message || e.message));
    } finally {
      setScanning(false);
    }
  }

  async function triage(id, status, note) {
    try {
      await api.post(`/anomalies/${id}/triage`, { status, note: note || null });
      toast.success(`Status: ${STATUS_LABELS[status] || status}`);
      setSelected(null);
      setSearchParams((p) => {
        const n = new URLSearchParams(p);
        n.delete("id");
        return n;
      });
      await load();
    } catch (e) {
      toast.error("Gagal update: " + (e?.response?.data?.errors?.[0]?.message || e.message));
    }
  }

  const counts = useMemo(() => {
    const c = { total: items.length, severe: 0, mild: 0, open: 0 };
    items.forEach((i) => {
      if (i.severity === "severe") c.severe++;
      else if (i.severity === "mild") c.mild++;
      if (i.status === "open") c.open++;
    });
    return c;
  }, [items]);

  return (
    <div className="space-y-4" data-testid="anomaly-feed-page">
      {/* Header strip */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center",
              counts.severe > 0 ? "bg-red-500/15 text-red-700" :
              counts.mild > 0 ? "bg-amber-500/15 text-amber-700" :
              "bg-emerald-500/15 text-emerald-700",
            )}>
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Anomaly Detection Feed</h2>
              <p className="text-xs text-muted-foreground">
                Deteksi real-time deviasi sales, harga vendor, lead time, dan spike kas/AP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="anomaly-reload-btn">
              <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
              Reload
            </Button>
            <Button onClick={runScan} disabled={scanning} data-testid="anomaly-scan-btn">
              <Play className={cn("h-4 w-4 mr-1.5", scanning && "animate-pulse")} />
              {scanning ? "Scanning…" : "Run Scan"}
            </Button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <SummaryTile label="Total Filtered" value={counts.total} tone="neutral" testid="sum-total" />
          <SummaryTile label="Severe" value={counts.severe} tone="severe" testid="sum-severe" />
          <SummaryTile label="Mild" value={counts.mild} tone="mild" testid="sum-mild" />
          <SummaryTile label="Open" value={counts.open} tone="open" testid="sum-open" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Filter className="h-3.5 w-3.5" /> Filter
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <Label className="text-[11px]">Tipe</Label>
            <select value={fType} onChange={(e) => setFType(e.target.value)}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="anomaly-filter-type">
              <option value="">Semua Tipe</option>
              {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-[11px]">Severity</Label>
            <select value={fSeverity} onChange={(e) => setFSeverity(e.target.value)}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="anomaly-filter-severity">
              <option value="">Semua</option>
              <option value="severe">Severe</option>
              <option value="mild">Mild</option>
            </select>
          </div>
          <div>
            <Label className="text-[11px]">Status</Label>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="anomaly-filter-status">
              <option value="">Semua Status</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="false_positive">False Positive</option>
            </select>
          </div>
          <div>
            <Label className="text-[11px]">Outlet</Label>
            <select value={fOutlet} onChange={(e) => setFOutlet(e.target.value)}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="anomaly-filter-outlet">
              <option value="">Semua Outlet</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-[11px]">Cari</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={fQuery} onChange={(e) => setFQuery(e.target.value)}
                placeholder="Cari judul / pesan"
                className="pl-8 h-9 text-sm" data-testid="anomaly-filter-query" />
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="glass-card p-2 sm:p-3">
        {loading ? (
          <LoadingState rows={5} />
        ) : filteredBySearch.length === 0 ? (
          <EmptyState
            icon={<Shield className="h-10 w-10 text-muted-foreground/50" />}
            title="Tidak ada anomaly ditemukan"
            description="Coba ubah filter atau jalankan Scan untuk refresh."
          />
        ) : (
          <ul className="divide-y divide-border/40">
            {filteredBySearch.map((ev) => (
              <AnomalyRow
                key={ev.id}
                ev={ev}
                onOpen={() => {
                  setSelected(ev);
                  setSearchParams((p) => {
                    const n = new URLSearchParams(p);
                    n.set("id", ev.id);
                    return n;
                  });
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Detail Sheet */}
      <AnomalyDetail
        event={selected}
        onClose={() => {
          setSelected(null);
          setSearchParams((p) => {
            const n = new URLSearchParams(p);
            n.delete("id");
            return n;
          });
        }}
        onTriage={triage}
        types={types}
      />
    </div>
  );
}

function SummaryTile({ label, value, tone, testid }) {
  const toneClass = {
    severe: "text-red-600 dark:text-red-400",
    mild: "text-amber-600 dark:text-amber-400",
    open: "text-sky-600 dark:text-sky-400",
    neutral: "text-foreground",
  }[tone] || "text-foreground";
  return (
    <div className="glass-input rounded-xl p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums", toneClass)}>{value}</div>
    </div>
  );
}

function AnomalyRow({ ev, onOpen }) {
  const sev = ev.severity || "none";
  const dev = typeof ev.deviation_pct === "number" ? ev.deviation_pct : null;
  return (
    <li
      className="p-3 sm:p-4 hover:bg-foreground/5 rounded-lg cursor-pointer transition-colors"
      onClick={onOpen}
      data-testid={`anomaly-row-${ev.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded", severityStyle(sev))}>
              {SEVERITY_LABELS[sev] || sev}
            </span>
            <span className={cn("text-[10px] uppercase font-semibold px-2 py-0.5 rounded", statusStyle(ev.status))}>
              {STATUS_LABELS[ev.status] || ev.status}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {ev.type_label || ev.type}
            </span>
          </div>
          <div className="font-semibold truncate">{ev.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ev.message}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {dev !== null && (
            <span className={cn(
              "text-sm font-bold tabular-nums",
              dev >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
            )}>
              {dev >= 0 ? "+" : ""}{dev.toFixed(1)}%
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{fmtRelative(ev.created_at)}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    </li>
  );
}

function AnomalyDetail({ event, onClose, onTriage }) {
  const [note, setNote] = useState("");
  useEffect(() => {
    setNote("");
  }, [event?.id]);

  if (!event) return null;
  const sev = event.severity || "none";
  const ctx = event.context || {};
  const disabled = event.status === "resolved" || event.status === "false_positive";

  return (
    <Sheet open={!!event} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto" data-testid="anomaly-detail-sheet">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded", severityStyle(sev))}>
              {SEVERITY_LABELS[sev] || sev}
            </span>
            <span>{event.title}</span>
          </SheetTitle>
          <SheetDescription>
            {event.type_label || event.type} · {fmtDateTime(event.created_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-4">
          {/* Message */}
          <div className="glass-input rounded-xl p-3 text-sm whitespace-pre-wrap">
            {event.message}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailStat label="Observed" value={event.observed_value} isMoney={event.type !== "vendor_leadtime"} />
            <DetailStat label="Baseline" value={event.baseline_value} isMoney={event.type !== "vendor_leadtime"} />
            {event.baseline_stddev != null && (
              <DetailStat label="Stddev (σ)" value={event.baseline_stddev} isMoney={true} />
            )}
            {event.z_score != null && (
              <DetailStat label="Z-score" value={event.z_score.toFixed(2)} />
            )}
            {event.deviation_pct != null && (
              <DetailStat
                label="Deviation"
                value={`${event.deviation_pct >= 0 ? "+" : ""}${event.deviation_pct.toFixed(1)}%`}
                tone={event.deviation_pct >= 0 ? "danger" : "good"}
              />
            )}
            {event.excess_days != null && (
              <DetailStat label="Excess Days" value={`${event.excess_days.toFixed(1)} hari`} tone="danger" />
            )}
            {event.baseline_count != null && (
              <DetailStat label="Sample Size" value={event.baseline_count} />
            )}
            {event.period && (
              <DetailStat label="Period" value={event.period} />
            )}
          </div>

          {/* Threshold snapshot */}
          {event.threshold_snapshot && (
            <div className="glass-input rounded-xl p-3 text-xs">
              <div className="font-semibold mb-1 text-muted-foreground uppercase text-[10px] tracking-wide">
                Threshold aktif saat deteksi
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[10px]">{JSON.stringify(event.threshold_snapshot, null, 2)}</pre>
            </div>
          )}

          {/* Context */}
          {ctx && Object.keys(ctx).length > 0 && (
            <div className="glass-input rounded-xl p-3 text-xs">
              <div className="font-semibold mb-1 text-muted-foreground uppercase text-[10px] tracking-wide">Context</div>
              <div className="space-y-0.5">
                {Object.entries(ctx).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}:</span>
                    <span className="font-mono">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source link */}
          {event.source_type && event.source_id && (
            <div className="text-xs text-muted-foreground">
              Source: <code className="font-mono">{event.source_type} · {event.source_doc_no || event.source_id.slice(0, 8)}</code>
            </div>
          )}

          {/* History of actions */}
          {event.acknowledged_at && (
            <div className="text-xs text-muted-foreground">
              Acknowledged: {fmtDateTime(event.acknowledged_at)}
              {event.acknowledged_note && ` — "${event.acknowledged_note}"`}
            </div>
          )}
          {event.resolved_at && (
            <div className="text-xs text-muted-foreground">
              Resolved: {fmtDateTime(event.resolved_at)}
              {event.resolution_note && ` — "${event.resolution_note}"`}
            </div>
          )}

          {/* Note input */}
          {!disabled && (
            <div>
              <Label className="text-xs">Catatan triage (opsional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tulis konteks atau alasan keputusan…"
                rows={3}
                className="mt-1"
                data-testid="anomaly-triage-note"
              />
            </div>
          )}
        </div>

        <SheetFooter className="flex-col sm:flex-col gap-2">
          {!disabled && (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => onTriage(event.id, "acknowledged", note)}
                data-testid="anomaly-ack-btn"
              >
                <Eye className="h-4 w-4 mr-1.5" /> Acknowledge
              </Button>
              <Button
                variant="outline"
                onClick={() => onTriage(event.id, "investigating", note)}
                data-testid="anomaly-investigate-btn"
              >
                <Clock className="h-4 w-4 mr-1.5" /> Investigating
              </Button>
              <Button
                onClick={() => onTriage(event.id, "resolved", note)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="anomaly-resolve-btn"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Resolve
              </Button>
              <Button
                variant="outline"
                onClick={() => onTriage(event.id, "false_positive", note)}
                data-testid="anomaly-fp-btn"
              >
                <XCircle className="h-4 w-4 mr-1.5" /> False Positive
              </Button>
            </div>
          )}
          {disabled && (
            <div className="text-xs text-muted-foreground text-center py-2">
              Anomaly sudah {STATUS_LABELS[event.status]}. Tidak ada aksi lanjutan.
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DetailStat({ label, value, isMoney, tone }) {
  const display = value == null ? "—" :
    (isMoney ? fmtRp(Number(value)) : String(value));
  const toneClass = tone === "danger" ? "text-red-600 dark:text-red-400"
                  : tone === "good" ? "text-emerald-600 dark:text-emerald-400"
                  : "";
  return (
    <div className="glass-input rounded-xl p-3">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide font-semibold">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums mt-0.5", toneClass)}>{display}</div>
    </div>
  );
}
