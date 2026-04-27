/** MyApprovals — cross-portal queue of pending items requiring the current user's action. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox, RefreshCw, ShoppingCart, Package, Sliders, Wallet, ExternalLink,
  ClipboardCheck, Sparkles, AlertTriangle, ShoppingBag,
} from "lucide-react";
import { motion } from "framer-motion";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import StatusPill from "@/components/shared/StatusPill";
import { fmtRp, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TABS = [
  { key: "all",               label: "Semua",            icon: Inbox },
  { key: "purchase_request",  label: "Purchase Request", icon: ClipboardCheck },
  { key: "purchase_order",    label: "Purchase Order",   icon: ShoppingCart },
  { key: "stock_adjustment",  label: "Stock Adjustment", icon: Sliders },
  { key: "employee_advance",  label: "Employee Advance", icon: Wallet },
  { key: "urgent_purchase",   label: "Urgent Purchase",  icon: ShoppingBag },
];

const ENTITY_ICONS = {
  purchase_request:  ClipboardCheck,
  purchase_order:    ShoppingCart,
  stock_adjustment:  Sliders,
  employee_advance:  Wallet,
  urgent_purchase:   ShoppingBag,
};

export default function MyApprovals() {
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [guardLogs, setGuardLogs] = useState({});  // key: source_id -> verdict log

  async function load() {
    setLoading(true);
    try {
      const params = tab === "all" ? {} : { entity_type: tab };
      const [q, c] = await Promise.all([
        api.get("/approvals/queue", { params: { ...params, per_page: 200 } }),
        api.get("/approvals/counts"),
      ]);
      const queue = unwrap(q) || [];
      setItems(queue);
      setCounts((unwrap(c) || {}).by_entity || {});

      // Best-effort: fetch latest forecast guard logs (last 30d) and index by source_id
      try {
        const lr = await api.get("/forecasting/guard/logs", { params: { days: 30, limit: 500 } });
        const logs = unwrap(lr) || [];
        const map = {};
        logs.forEach(l => { if (l.source_id) map[l.source_id] = l; });
        setGuardLogs(map);
      } catch { /* user may not have perm; widget gracefully degrades */ }
    } catch {
      toast.error("Gagal memuat queue");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const totalCount = useMemo(
    () => Object.values(counts || {}).reduce((s, v) => s + (v || 0), 0),
    [counts],
  );

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-2xl grad-aurora flex items-center justify-center">
          <Inbox className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold leading-tight">My Approvals</h2>
          <p className="text-xs text-muted-foreground">
            Daftar dokumen yang menunggu aksi Anda dari semua portal.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="rounded-full gap-2 h-9" data-testid="my-approvals-refresh">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Total Pending" value={totalCount} accent active={tab === "all"} onClick={() => setTab("all")} dataTestId="stat-total" />
        {TABS.slice(1).map(t => (
          <StatTile key={t.key} label={t.label}
            value={counts?.[t.key] ?? 0}
            icon={t.icon}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
            dataTestId={`stat-${t.key}`} />
        ))}
      </div>

      {/* Tabs (mobile / quick switch) */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-3 py-1.5 text-xs rounded-full font-medium whitespace-nowrap shrink-0",
              tab === t.key ? "pill-active" : "glass-input hover:bg-foreground/5")}>
            {t.label} {(t.key !== "all" && counts?.[t.key]) ? <span className="ml-1 opacity-80">({counts[t.key]})</span> : null}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? <LoadingState rows={6} /> : (
        items.length === 0 ? (
          <EmptyState icon={Sparkles} title="Tidak ada approval menunggu"
            description="Semua dokumen yang membutuhkan aksi Anda sudah selesai. 🎉" />
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => (
              <QueueRow key={it.entity_id} item={it} index={i}
                guardLog={guardLogs[it.entity_id]} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function StatTile({ label, value, accent = false, active = false, icon: Icon, onClick, dataTestId }) {
  return (
    <motion.button
      whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
      onClick={onClick}
      data-testid={dataTestId}
      className={cn(
        "glass-card p-4 text-left transition-colors relative overflow-hidden",
        active && "ring-2 ring-aurora/60",
      )}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold truncate">{label}</div>
      </div>
      <div className={cn("text-2xl font-bold tabular-nums mt-1", accent && "text-aurora")}>{value}</div>
    </motion.button>
  );
}

function QueueRow({ item, index, guardLog }) {
  const Icon = ENTITY_ICONS[item.entity_type] || Inbox;
  const isSevere = guardLog?.severity === "severe";
  const isMild = guardLog?.severity === "mild";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.4), duration: 0.18 }}
      className={cn(
        "glass-card p-4",
        isSevere && "ring-2 ring-red-500/40",
        isMild && "ring-2 ring-amber-500/40",
      )}>
      <Link to={item.link} className="flex items-center gap-3 group" data-testid={`queue-row-${item.entity_id}`}>
        <div className="h-10 w-10 rounded-2xl bg-aurora/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-aurora" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{item.label}</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-foreground/5 truncate">{item.describe}</span>
            <StatusPill status={item.status} />
            {item.is_legacy && (
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">legacy</span>
            )}
            {guardLog && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-bold",
                  isSevere
                    ? "bg-red-500/20 text-red-700 dark:text-red-300"
                    : "bg-amber-500/20 text-amber-700 dark:text-amber-300",
                )}
                data-testid={`queue-guard-${item.entity_id}-${guardLog.severity}`}
                title={guardLog.message}
              >
                <AlertTriangle className="h-3 w-3" />
                forecast {guardLog.severity} · +{Math.abs(guardLog.deviation_pct || 0).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {item.tier_label && (
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px] uppercase tracking-wide">tier</span>
                <span className="font-medium text-foreground">{item.tier_label}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide">menunggu</span>
              <span className="font-medium text-foreground">{item.step_label}</span>
            </span>
            <span>·</span>
            <span>{fmtRelative(item.submitted_at || item.created_at)}</span>
            {guardLog?.reason && (
              <>
                <span>·</span>
                <span className="italic truncate max-w-[280px]" title={guardLog.reason}>
                  reason: {guardLog.reason}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.amount_label || "Amount"}</div>
          <div className="text-base font-bold tabular-nums">{fmtRp(item.amount || 0)}</div>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
      </Link>
    </motion.div>
  );
}
