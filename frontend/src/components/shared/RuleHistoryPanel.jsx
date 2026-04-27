/** RuleHistoryPanel — version timeline list per (scope, rule_type).
 * Used in the right column of configuration list pages.
 */
import { History, ArrowUpDown, Clock } from "lucide-react";
import StatusPill from "@/components/shared/StatusPill";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function statusOf(rule) {
  if (!rule.active) return "disabled";
  const today = new Date().toISOString().slice(0, 10);
  if (rule.effective_from && rule.effective_from > today) return "draft";
  if (rule.effective_to && rule.effective_to < today) return "closed";
  return "active";
}

export default function RuleHistoryPanel({ items = [], onSelect, currentId, emptyHint }) {
  return (
    <div className="glass-card p-4 sticky top-4" data-testid="config-rule-history-panel">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-foreground/60" />
          <h3 className="text-sm font-semibold">Riwayat Aturan</h3>
        </div>
        <span className="text-[11px] text-muted-foreground">{items.length} versi</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">
          {emptyHint || "Belum ada versi untuk scope ini."}
        </p>
      ) : (
        <ul className="space-y-2" data-testid="config-rule-history-list">
          {items.map((r) => {
            const status = statusOf(r);
            const isCurrent = r.id === currentId;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(r)}
                  className={cn(
                    "w-full text-left rounded-lg border border-border/40 px-3 py-2.5",
                    "transition-colors hover:bg-foreground/[0.03]",
                    isCurrent && "border-foreground/30 bg-foreground/[0.04]",
                  )}
                  data-testid={`config-rule-history-${r.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">v{r.version}</span>
                        <StatusPill status={status} />
                      </div>
                      <p className="text-sm font-medium truncate mt-1">{r.name || r.rule_type}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {r.effective_from ? fmtDate(r.effective_from) : "sejak awal"} — {r.effective_to ? fmtDate(r.effective_to) : "tanpa batas"}
                      </p>
                    </div>
                    {(r.overlaps_with?.length || 0) > 0 && (
                      <span
                        className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        title="Periode bentrok"
                      >
                        Bentrok
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ArrowUpDown className="h-3 w-3" />
          Versi terbaru di atas
        </span>
      </div>
    </div>
  );
}
