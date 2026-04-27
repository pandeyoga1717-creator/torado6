/** ForecastGuardBanner — pre-submit guardrail showing how a proposed amount compares to the
 * monthly forecast for an outlet/brand. Silent when within forecast (severity=none).
 *
 * Props:
 *  - amount      (number)   Required. The amount being proposed.
 *  - outletId    (string?)  Optional. Scopes the forecast to one outlet.
 *  - brandId     (string?)  Optional. Scopes the forecast to one brand.
 *  - kind        (string?)  "expense" (default) or "revenue".
 *  - period      (string?)  YYYY-MM. Defaults to current month server-side.
 *  - debounceMs  (number?)  Default 600 — avoids hammering the API while typing.
 *  - onChange    (fn?)      Called with the verdict whenever it changes.
 *  - hideWhenSafe (bool?)   Default true — hide banner when severity=none.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ShieldCheck, Info, Loader2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEVERITY_STYLE = {
  none: {
    bg: "bg-emerald-500/5 border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
    Icon: ShieldCheck,
    label: "Within Forecast",
  },
  mild: {
    bg: "bg-amber-500/10 border-amber-500/40",
    text: "text-amber-800 dark:text-amber-300",
    Icon: AlertTriangle,
    label: "Above Forecast",
  },
  severe: {
    bg: "bg-red-500/10 border-red-500/50",
    text: "text-red-800 dark:text-red-300",
    Icon: AlertTriangle,
    label: "Far Above Forecast",
  },
};

export default function ForecastGuardBanner({
  amount,
  outletId,
  brandId,
  kind = "expense",
  period,
  debounceMs = 600,
  onChange,
  hideWhenSafe = true,
  showCheckButton = false,
  className = "",
}) {
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef();
  const lastReqRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!amount || Number(amount) <= 0) {
      setVerdict(null);
      onChange?.(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const reqId = ++lastReqRef.current;
      setLoading(true);
      try {
        const res = await api.post("/forecasting/guard/check", {
          amount: Number(amount),
          outlet_id: outletId || null,
          brand_id: brandId || null,
          kind,
          period: period || null,
        });
        if (reqId !== lastReqRef.current) return; // stale
        const v = unwrap(res);
        setVerdict(v);
        onChange?.(v);
      } catch (e) {
        setVerdict({
          severity: "none", message: "Tidak dapat memverifikasi forecast saat ini.",
          forecast_value: 0, projected: 0, mtd_amount: 0, ci_band: 0, deviation_pct: 0,
          error: true,
        });
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [amount, outletId, brandId, kind, period, debounceMs]); // eslint-disable-line

  if (!amount || Number(amount) <= 0) return null;
  if (loading && !verdict) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground px-3 py-2", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memeriksa forecast…
      </div>
    );
  }
  if (!verdict) return null;
  if (verdict.error) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground px-3 py-2", className)}>
        <Info className="h-3.5 w-3.5" /> {verdict.message}
      </div>
    );
  }
  if (hideWhenSafe && verdict.severity === "none" && !showCheckButton) return null;

  const style = SEVERITY_STYLE[verdict.severity] || SEVERITY_STYLE.none;
  const { Icon } = style;

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors",
        style.bg, style.text, className,
      )}
      data-testid={`forecast-guard-${verdict.severity}`}
    >
      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold uppercase tracking-wide text-[11px]">{style.label}</span>
          {verdict.deviation_pct != null && verdict.severity !== "none" && (
            <span className="text-xs tabular-nums font-semibold">
              ({verdict.deviation_pct >= 0 ? "+" : ""}{verdict.deviation_pct}%)
            </span>
          )}
          <span className="text-[10px] uppercase tracking-wider opacity-70">period {verdict.period}</span>
        </div>
        <div className="mt-1 leading-relaxed">{verdict.message}</div>
        <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] tabular-nums opacity-90">
          <Stat label="MTD" value={fmtRp(verdict.mtd_amount)} />
          <Stat label="Proposed" value={fmtRp(verdict.amount)} />
          <Stat label="Projected" value={fmtRp(verdict.projected)} bold />
          <Stat label="Forecast" value={fmtRp(verdict.forecast_value)} ci={verdict.ci_band} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, bold, ci }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide opacity-60">{label}</span>
      <span className={cn(bold && "font-bold")}>{value}</span>
      {ci != null && ci > 0 && (
        <span className="text-[9px] opacity-50">±{fmtRp(ci)}</span>
      )}
    </div>
  );
}
