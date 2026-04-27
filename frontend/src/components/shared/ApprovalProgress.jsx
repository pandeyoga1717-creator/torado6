/** ApprovalProgress — visualizes multi-tier approval state for an entity.
 *  Props:
 *    state: { has_workflow, tier, amount, steps, current_step_idx, is_complete, is_rejected, executed_steps }
 *    compact?: boolean
 */
import { CheckCircle2, Circle, XCircle, Clock } from "lucide-react";
import { fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ApprovalProgress({ state, compact = false }) {
  if (!state) return null;
  if (state.is_rejected) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400 inline-flex items-center gap-2">
        <XCircle className="h-4 w-4" /> Rejected
      </div>
    );
  }
  if (!state.has_workflow) {
    return (
      <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" /> No workflow configured (legacy single-step approval)
      </div>
    );
  }
  const steps = state.steps || [];
  const curIdx = state.current_step_idx;
  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{state.tier?.label || "Tier"}</div>
        <div className="text-xs tabular-nums">{fmtRp(state.amount || 0)}</div>
      </div>
      <div className="flex items-stretch gap-2">
        {steps.map((s, i) => {
          const done = i < (state.executed_steps?.filter(e => e.action === "approved").length || 0);
          const isCurrent = curIdx === i;
          return (
            <div key={i} className={cn(
              "flex-1 rounded-xl border px-3 py-2 transition-colors",
              done ? "border-emerald-500/40 bg-emerald-500/5" :
              isCurrent ? "border-aurora/40 bg-aurora/5" :
              "border-border/50 bg-foreground/[0.02]",
            )}>
              <div className="flex items-center gap-2">
                {done
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  : isCurrent
                    ? <Clock className="h-3.5 w-3.5 text-aurora animate-pulse" />
                    : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-xs font-semibold">{s.label || `Step ${i + 1}`}</span>
              </div>
              {!compact && (
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {(s.any_of_perms || []).join(" / ") || "—"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {state.is_complete && (
        <div className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approval chain complete
        </div>
      )}
    </div>
  );
}
