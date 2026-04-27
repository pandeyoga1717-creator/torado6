/** Procurement Home — KPIs + recent activity. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, FileCheck, PackageOpen, ArrowRight, Clock } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import KpiCard from "@/components/shared/KpiCard";
import StatusPill from "@/components/shared/StatusPill";
import { fmtRp, fmtDate, fmtRelative } from "@/lib/format";

export default function ProcurementHome() {
  const [stats, setStats] = useState({ pr_pending: 0, pr_total: 0, po_open: 0, po_total: 0, gr_total: 0 });
  const [recentPR, setRecentPR] = useState([]);
  const [recentPO, setRecentPO] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [prSubmitted, prAll, poOpen, poAll, grAll] = await Promise.all([
          api.get("/procurement/prs", { params: { status: "submitted", per_page: 5 } }),
          api.get("/procurement/prs", { params: { per_page: 5 } }),
          api.get("/procurement/pos", { params: { status: "sent", per_page: 5 } }),
          api.get("/procurement/pos", { params: { per_page: 5 } }),
          api.get("/procurement/grs", { params: { per_page: 5 } }),
        ]);
        setStats({
          pr_pending: prSubmitted.data?.meta?.total || 0,
          pr_total: prAll.data?.meta?.total || 0,
          po_open: poOpen.data?.meta?.total || 0,
          po_total: poAll.data?.meta?.total || 0,
          gr_total: grAll.data?.meta?.total || 0,
        });
        setRecentPR(unwrap(prAll) || []);
        setRecentPO(unwrap(poAll) || []);
      } catch (e) {
        // ignore
      } finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-1">Procurement Overview</h2>
        <p className="text-sm text-muted-foreground">
          Lihat status pengadaan, kelola PR/PO, dan posting goods receipt.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="PR Pending" value={loading ? "…" : stats.pr_pending}
          hint={`${stats.pr_total} total`} icon={FileText} color="aurora-1" />
        <KpiCard label="PO Open" value={loading ? "…" : stats.po_open}
          hint={`${stats.po_total} total`} icon={FileCheck} color="aurora-2" />
        <KpiCard label="GR Posted" value={loading ? "…" : stats.gr_total}
          hint="All-time" icon={PackageOpen} color="aurora-4" />
        <KpiCard label="Quick Actions" value=" " hint="Buat PR baru" icon={ArrowRight} color="aurora-5"
          onClick={() => window.location.assign("/procurement/pr/new")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Purchase Requests</h3>
            <Link to="/procurement/pr" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentPR.length === 0 && <div className="text-sm text-muted-foreground italic">Belum ada PR.</div>}
          <div className="space-y-2">
            {recentPR.map(pr => (
              <Link key={pr.id} to={`/procurement/pr/${pr.id}`} className="glass-input rounded-xl px-3 py-2.5 flex items-center gap-3 hover:bg-foreground/5 transition">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{pr.doc_no || pr.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(pr.request_date)} · {pr.lines?.length || 0} item
                  </div>
                </div>
                <StatusPill status={pr.status} />
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Purchase Orders</h3>
            <Link to="/procurement/po" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentPO.length === 0 && <div className="text-sm text-muted-foreground italic">Belum ada PO.</div>}
          <div className="space-y-2">
            {recentPO.map(po => (
              <Link key={po.id} to={`/procurement/po/${po.id}`} className="glass-input rounded-xl px-3 py-2.5 flex items-center gap-3 hover:bg-foreground/5 transition">
                <FileCheck className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{po.doc_no || po.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(po.order_date)} · {fmtRp(po.grand_total || 0)}
                  </div>
                </div>
                <StatusPill status={po.status} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
