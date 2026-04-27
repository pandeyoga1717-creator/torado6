/** Chart of Accounts browser — read-only viewer (write via Admin Master Data). */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ExternalLink, Wallet } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const TYPES = [
  { v: "",          l: "Semua Type" },
  { v: "asset",     l: "Asset" },
  { v: "liability", l: "Liability" },
  { v: "equity",    l: "Equity" },
  { v: "revenue",   l: "Revenue" },
  { v: "cogs",      l: "COGS" },
  { v: "expense",   l: "Expense" },
];

export default function COABrowser() {
  const { can } = useAuth();
  const [coas, setCoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [postableOnly, setPostableOnly] = useState(false);

  useEffect(() => {
    api.get("/master/chart-of-accounts", { params: { per_page: 100 } })
      .then(r => setCoas(unwrap(r) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let rows = coas;
    if (type) rows = rows.filter(r => r.type === type);
    if (postableOnly) rows = rows.filter(r => r.is_postable);
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter(r =>
        (r.code || "").toLowerCase().includes(s) ||
        (r.name || "").toLowerCase().includes(s) ||
        (r.name_id || "").toLowerCase().includes(s),
      );
    }
    return rows.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  }, [coas, type, q, postableOnly]);

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Type</Label>
          <select value={type} onChange={e => setType(e.target.value)}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" data-testid="coa-type">
            {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Cari COA</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Code / nama akun…" className="glass-input pl-9 h-9" data-testid="coa-search" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs h-9 cursor-pointer select-none" data-testid="coa-postable-toggle">
          <input type="checkbox" checked={postableOnly} onChange={e => setPostableOnly(e.target.checked)} />
          Postable saja
        </label>
        {can("admin.master_data.manage") && (
          <Link to="/admin/master-data?tab=chart-of-accounts" className="ml-auto inline-flex items-center gap-1 text-xs text-foreground/80 hover:text-foreground font-medium" data-testid="coa-edit-link">
            Kelola di Admin <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Normal</Th>
              <Th>Postable</Th>
              <Th>Active</Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-6"><LoadingState rows={8} /></td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={Wallet} title="COA tidak ditemukan" /></td></tr>
              )}
              {!loading && filtered.map(c => (
                <tr key={c.id} className={cn("border-b border-border/30 hover:bg-foreground/5",
                  !c.is_postable && "text-muted-foreground")}>
                  <td className="px-5 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-5 py-2">
                    <div className="font-medium">{c.name}</div>
                    {c.name_id && <div className="text-xs text-muted-foreground">{c.name_id}</div>}
                  </td>
                  <td className="px-5 py-2 capitalize">{c.type}</td>
                  <td className="px-5 py-2">{c.normal_balance}</td>
                  <td className="px-5 py-2">
                    {c.is_postable ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">Yes</span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-foreground/10 text-muted-foreground">Header</span>
                    )}
                  </td>
                  <td className="px-5 py-2">
                    {c.active ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">Active</span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 font-medium">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
