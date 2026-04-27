import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KpiCard({ label, value, delta, hint, icon: Icon, onClick, color = "aurora-1" }) {
  const positive = delta != null && delta >= 0;
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "glass-card-hover p-5 text-left w-full block group cursor-pointer",
        !onClick && "cursor-default",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background: `hsl(var(--${color}) / 0.15)`,
              color: `hsl(var(--${color}))`,
            }}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="text-2xl lg:text-3xl font-bold tracking-tight tabular-nums">{value}</div>
      {(delta != null || hint) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                positive ? "text-emerald-600" : "text-red-600",
              )}
            >
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {positive ? "+" : ""}{Number(delta).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </motion.button>
  );
}
