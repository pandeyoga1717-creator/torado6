import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, AlertTriangle, Info, CheckCircle, Mail } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_ICONS = {
  urgent: AlertTriangle,
  warn: AlertTriangle,
  info: Info,
  done: CheckCircle,
};
const TYPE_COLORS = {
  urgent: "text-red-600 bg-red-100 dark:bg-red-950/30",
  warn:   "text-amber-600 bg-amber-100 dark:bg-amber-950/30",
  info:   "text-blue-600 bg-blue-100 dark:bg-blue-950/30",
  done:   "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/30",
};

export default function NotificationDrawer({ open, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/notifications", {
        params: filter === "unread" ? { unread_only: true } : {},
      });
      setItems(unwrap(res) || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open, filter]);

  async function markAllRead() {
    await api.post("/notifications/mark-all-read");
    load();
  }

  async function markRead(id) {
    await api.post(`/notifications/${id}/read`);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }

  async function handleClick(n) {
    if (!n.read_at) {
      try { await markRead(n.id); } catch { /* ignore */ }
    }
    if (n.link) {
      onClose?.();
      navigate(n.link);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-foreground/30"
            style={{ backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 h-full w-full sm:w-[420px] glass-card z-50 flex flex-col"
            style={{ borderRadius: 0, borderLeft: "1px solid rgb(var(--glass-border))" }}
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <h2 className="font-semibold">Notifications</h2>
              </div>
              <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-foreground/5 flex items-center justify-center" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-3 flex items-center gap-2 border-b border-border/50">
              {[{ k: "all", l: "Semua" }, { k: "unread", l: "Belum dibaca" }].map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-full font-medium transition-colors",
                    filter === f.k ? "pill-active" : "hover:bg-foreground/5",
                  )}
                >
                  {f.l}
                </button>
              ))}
              <button
                onClick={markAllRead}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              )}
              {!loading && items.length === 0 && (
                <div className="px-5 py-16 flex flex-col items-center text-center text-muted-foreground">
                  <Mail className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">Belum ada notifikasi</p>
                </div>
              )}
              {!loading && items.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Info;
                const color = TYPE_COLORS[n.type] || TYPE_COLORS.info;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full px-5 py-3 hover:bg-foreground/5 transition-colors text-left flex items-start gap-3",
                      !n.read_at && "bg-aurora/5",
                    )}
                    data-testid={`notif-row-${n.id}`}
                  >
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm leading-snug", !n.read_at && "font-semibold")}>
                          {n.title}
                        </p>
                        {!n.read_at && <span className="h-2 w-2 mt-1.5 rounded-full bg-aurora-1 shrink-0" style={{ background: "hsl(var(--aurora-1))" }} />}
                      </div>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">{fmtRelative(n.created_at)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
