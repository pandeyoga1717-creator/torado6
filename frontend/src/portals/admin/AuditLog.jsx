import { useEffect, useState } from "react";
import api, { unwrap } from "@/lib/api";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRelative, fmtDateTime } from "@/lib/format";
import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTION_COLORS = {
  create: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  update: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  delete: "bg-red-500/15 text-red-700 dark:text-red-400",
  disable: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  reset_password: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  login: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  logout: "bg-zinc-300 text-zinc-700",
};

export default function AuditLog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState({ entity_type: "", action: "" });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 50 });

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 50 };
      if (q.entity_type) params.entity_type = q.entity_type;
      if (q.action) params.action = q.action;
      const res = await api.get("/admin/audit-log", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 50)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Filter entity_type" value={q.entity_type}
               onChange={e => setQ({...q, entity_type: e.target.value})}
               className="glass-input h-10 max-w-[160px]" />
        <Input placeholder="Filter action" value={q.action}
               onChange={e => setQ({...q, action: e.target.value})}
               className="glass-input h-10 max-w-[160px]" />
        <Button onClick={() => { setPage(1); load(); }} className="rounded-full pill-active gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border/50">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Waktu</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entity</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">ID</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="p-6"><LoadingState rows={6} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5}><EmptyState title="Belum ada audit entry" /></td></tr>
              )}
              {!loading && items.map((e) => (
                <tr key={e.id} className="border-b border-border/30 hover:bg-foreground/5">
                  <td className="px-5 py-3 text-xs whitespace-nowrap">
                    <div>{fmtDateTime(e.timestamp)}</div>
                    <div className="text-muted-foreground">{fmtRelative(e.timestamp)}</div>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-muted-foreground">{(e.user_id || "—").slice(0,8)}…</td>
                  <td className="px-5 py-3 text-xs">{e.entity_type}</td>
                  <td className="px-5 py-3">
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", ACTION_COLORS[e.action] || "bg-foreground/10")}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-muted-foreground">{(e.entity_id || "—").slice(0,8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
