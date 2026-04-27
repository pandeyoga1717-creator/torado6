/** EffectiveDatingTimelinePage — visualises versions per rule_type for the
 * selected scope. CSS-grid based timeline (month-aware), highlights overlaps.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, AlertTriangle, History as HistoryIcon } from "lucide-react";

import api, { unwrap, unwrapError } from "@/lib/api";
import { useScope } from "@/components/shared/ScopePicker";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtDate } from "@/lib/format";
import { RULE_LABELS, ruleStatus, effectiveText } from "./configHelpers";
import { cn } from "@/lib/utils";

const RULE_TYPES = [
  "sales_input_schema",
  "petty_cash_policy",
  "service_charge_policy",
  "incentive_policy",
];

function monthRange(now = new Date()) {
  // 6 months back, 6 months forward
  const list = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
  for (let i = 0; i < 13; i++) {
    list.push(new Date(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return list;
}

function iso(d) { return d.toISOString().slice(0, 10); }
function monthKey(d) { return d.toISOString().slice(0, 7); }

function barOffsetWidth(rule, axis) {
  // axis = array of months Date[]; total grid columns = axis.length
  const start = axis[0];
  const end = new Date(axis[axis.length - 1]);
  end.setUTCMonth(end.getUTCMonth() + 1); // exclusive
  const ruleFrom = rule.effective_from ? new Date(rule.effective_from + "T00:00:00Z") : start;
  const ruleTo = rule.effective_to ? new Date(rule.effective_to + "T00:00:00Z") : end;
  const totalMs = end - start;
  const fromMs = Math.max(start, ruleFrom) - start;
  const toMs = Math.min(end, ruleTo) - start;
  const left = Math.max(0, (fromMs / totalMs) * 100);
  const right = Math.min(100, (toMs / totalMs) * 100);
  return { left, width: Math.max(2, right - left) };
}

export default function EffectiveDatingTimelinePage() {
  const { scope_type, scope_id } = useScope();
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const axis = useMemo(() => monthRange(), []);

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await api.get("/admin/business-rules/timeline", {
        params: {
          scope_type, scope_id,
          ...(filter !== "all" ? { rule_type: filter } : {}),
        },
      });
      setRows(unwrap(r) || []);
    } catch (e) {
      setError(unwrapError(e));
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [scope_type, scope_id, filter]);

  const grouped = useMemo(() => {
    const out = {};
    for (const r of rows) {
      if (!RULE_TYPES.includes(r.rule_type)) continue;
      out[r.rule_type] = out[r.rule_type] || [];
      out[r.rule_type].push(r);
    }
    return out;
  }, [rows]);

  const totalOverlaps = rows.filter((r) => (r.overlaps_with || []).length > 0).length;

  return (
    <div className="space-y-4" data-testid="config-effective-dating-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Versi & Jadwal
          </h2>
          <p className="text-xs text-muted-foreground">
            Lihat semua versi aturan beserta periode berlaku. Periode bentrok ditandai oranye.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm" className="rounded-full"
            onClick={() => setFilter("all")}
            data-testid="timeline-filter-all"
          >Semua</Button>
          {RULE_TYPES.map((rt) => (
            <Button
              key={rt}
              variant={filter === rt ? "default" : "outline"}
              size="sm" className="rounded-full"
              onClick={() => setFilter(rt)}
              data-testid={`timeline-filter-${rt}`}
            >{RULE_LABELS[rt]}</Button>
          ))}
        </div>
      </div>

      {totalOverlaps > 0 && (
        <div
          className="glass-card p-3 border border-amber-500/40 flex items-start gap-2"
          data-testid="config-timeline-overlap-warning"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <strong>{totalOverlaps}</strong> aturan memiliki periode yang bentrok. Periksa kembali agar perhitungan konsisten.
          </p>
        </div>
      )}

      {error && (
        <div className="glass-card p-4 border border-destructive/40 text-sm" data-testid="timeline-error">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState rows={6} />
      ) : rows.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={HistoryIcon}
            title="Belum ada versi"
            description="Buat aturan dari halaman terkait untuk mulai melihat timeline."
          />
        </div>
      ) : (
        <div className="glass-card p-4">
          <TimelineAxis axis={axis} />
          {Object.entries(grouped).map(([rt, items]) => (
            <TimelineRow key={rt} ruleType={rt} items={items} axis={axis} />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineAxis({ axis }) {
  return (
    <div className="relative" aria-hidden>
      <div className="grid pl-44 mb-1" style={{ gridTemplateColumns: `repeat(${axis.length}, 1fr)` }}>
        {axis.map((m) => (
          <div key={monthKey(m)} className="text-[10px] text-muted-foreground text-center border-l border-border/30 first:border-0 px-1">
            {m.toLocaleDateString("id-ID", { month: "short", year: "2-digit" })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineRow({ ruleType, items, axis }) {
  const today = new Date();
  const todayPos = (() => {
    const start = axis[0];
    const end = new Date(axis[axis.length - 1]);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const ms = Math.min(Math.max(today - start, 0), end - start);
    return (ms / (end - start)) * 100;
  })();

  return (
    <div className="py-3 border-t border-border/40 first:border-0">
      <div className="flex items-center gap-3">
        <div className="w-44 shrink-0">
          <p className="text-sm font-medium">{RULE_LABELS[ruleType] || ruleType}</p>
          <p className="text-[10px] text-muted-foreground">{items.length} versi</p>
        </div>
        <div className="flex-1 relative h-12 rounded-md bg-foreground/[0.02] border border-border/30 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/40 z-10"
            style={{ left: `${todayPos}%` }}
            data-testid="config-timeline-today-marker"
            title={"Hari ini — " + iso(today)}
          />
          {items.map((r, i) => {
            const { left, width } = barOffsetWidth(r, axis);
            const overlap = (r.overlaps_with || []).length > 0;
            const status = ruleStatus(r);
            return (
              <TooltipProvider key={r.id} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: `${(i % 3) * 14 + 4}px`,
                      }}
                      className={cn(
                        "absolute h-3 rounded-sm cursor-pointer",
                        status === "active" && "grad-aurora-soft border border-foreground/20",
                        status === "draft" && "bg-muted border border-border/60",
                        status === "closed" && "bg-zinc-300/60 dark:bg-zinc-700/40 border border-border/40",
                        status === "disabled" && "bg-zinc-200/60 dark:bg-zinc-800/40 border border-border/40 opacity-60",
                        overlap && "ring-1 ring-amber-500/70",
                      )}
                      data-testid={`config-timeline-version-bar-${r.id}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">v{r.version}</span>
                        <StatusPill status={status} />
                      </div>
                      <div className="font-medium">{r.name || ruleType}</div>
                      <div className="text-muted-foreground">{effectiveText(r)}</div>
                      {overlap && (
                        <div className="text-amber-600">Bentrok dengan {r.overlaps_with.length} versi lain</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </div>
  );
}
