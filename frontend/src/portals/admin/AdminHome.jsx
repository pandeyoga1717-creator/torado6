import { useEffect, useState } from "react";
import { Users as UsersIcon, Shield, Database, ScrollText, Hash, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import KpiCard from "@/components/shared/KpiCard";
import { fmtNumber } from "@/lib/format";
import { useAuth } from "@/lib/auth";

const MASTER_TILES = [
  { entity: "items",            label: "Items",        col: "items" },
  { entity: "vendors",          label: "Vendors",      col: "vendors" },
  { entity: "employees",        label: "Employees",    col: "employees" },
  { entity: "chart-of-accounts", label: "GL Accounts", col: "chart_of_accounts" },
  { entity: "brands",           label: "Brands",       col: "brands" },
  { entity: "outlets",          label: "Outlets",      col: "outlets" },
  { entity: "categories",       label: "Categories",   col: "categories" },
  { entity: "payment-methods",  label: "Payment Methods", col: "payment_methods" },
];

export default function AdminHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const tiles = MASTER_TILES.map(t => t.entity);
        const promises = tiles.map(e => api.get(`/master/${e}`, { params: { per_page: 1 } }));
        // also users + roles + audit
        promises.push(api.get("/admin/users", { params: { per_page: 1 } }));
        promises.push(api.get("/admin/roles"));
        promises.push(api.get("/admin/audit-log", { params: { per_page: 1 } }));
        const responses = await Promise.all(promises);
        const result = {};
        tiles.forEach((e, i) => {
          result[e] = responses[i].data?.meta?.total || 0;
        });
        result.users = responses[tiles.length].data?.meta?.total || 0;
        result.roles = (responses[tiles.length + 1].data?.data || []).length;
        result.audit = responses[tiles.length + 2].data?.meta?.total || 0;
        setStats(result);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="glass-card p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold mb-1">Halo, {user?.full_name?.split(" ")[0]} 👋</h2>
            <p className="text-sm text-muted-foreground">
              Sistem Aurora F&B siap melayani. Phase 2 Foundation aktif.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
              • Online
            </span>
            <span>v0.2.0</span>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Users"     value={loading ? "…" : fmtNumber(stats.users || 0)}
                  hint="Active users" icon={UsersIcon} color="aurora-1" />
        <KpiCard label="Roles"     value={loading ? "…" : fmtNumber(stats.roles || 0)}
                  hint="System & custom" icon={Shield} color="aurora-2" />
        <KpiCard label="Audit Log" value={loading ? "…" : fmtNumber(stats.audit || 0)}
                  hint="Recorded events" icon={ScrollText} color="aurora-3" />
        <KpiCard label="Master Records" value={loading ? "…" : fmtNumber(
            MASTER_TILES.reduce((sum, t) => sum + (stats[t.entity] || 0), 0)
          )} hint="All masters" icon={Database} color="aurora-4" />
      </div>

      {/* Master tiles */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Master Data
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MASTER_TILES.map((t) => (
            <Link
              key={t.entity}
              to={`/admin/master/${t.entity}`}
              className="glass-card-hover p-4 group"
              data-testid={`tile-${t.entity}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{t.label}</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">
                    {loading ? "…" : fmtNumber(stats[t.entity] || 0)}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
