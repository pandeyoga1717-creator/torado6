/** Approval chain visualization — timeline of approval steps. */
import { Check, X, Clock } from "lucide-react";
import { fmtRelative } from "@/lib/format";

export default function ApprovalChain({ chain = [] }) {
  if (!chain.length) {
    return (
      <div className="glass-input rounded-lg p-3 text-center text-xs text-muted-foreground">
        Belum ada approval action
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {chain.map((step, i) => {
        const isApproved = step.action === "approved";
        const isRejected = step.action === "rejected";
        const Icon = isApproved ? Check : (isRejected ? X : Clock);
        const colorCls = isApproved
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : (isRejected ? "bg-red-500/15 text-red-700 dark:text-red-400"
             : "bg-amber-500/15 text-amber-700 dark:text-amber-400");
        return (
          <div key={i} className="flex items-start gap-3">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${colorCls}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 text-sm">
              <div className="font-medium capitalize">
                Level {step.level}
                {step.step_label ? <span className="text-muted-foreground"> · {step.step_label}</span> : null}
                {" · "}{step.action}
              </div>
              {step.approver_name && (
                <div className="text-[11px] text-muted-foreground">oleh {step.approver_name}</div>
              )}
              {step.note && <div className="text-xs text-muted-foreground mt-0.5">{step.note}</div>}
              <div className="text-[11px] text-muted-foreground">{fmtRelative(step.at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
