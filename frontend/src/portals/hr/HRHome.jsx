/** HR Home — dashboard cards + quick actions. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, Wallet, Receipt, Trophy, Ticket, PiggyBank, ArrowRight,
  CalendarClock, AlertTriangle,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import KpiCard from "@/components/shared/KpiCard";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp } from "@/lib/format";

export default function HRHome() {
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/hr/dashboard")
      .then(r => setHome(unwrap(r) || {}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState variant="cards" />;

  return (
    <div className="space-y-6" data-testid="hr-home">
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-1">HR Overview</h2>
        <p className="text-sm text-muted-foreground">
          Periode aktif: <span className="font-medium text-foreground">{home?.period}</span>
          {' '}· monitoring kasbon, service charge, incentive & voucher.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Employees" value={home?.active_employees ?? 0}
          hint="Karyawan aktif" icon={Users} color="aurora-1" />
        <KpiCard label="Open Advances" value={home?.open_advances ?? 0}
          hint={`Outstanding: ${fmtRp(home?.advance_outstanding ?? 0)}`}
          icon={Wallet} color="aurora-2"
          onClick={() => window.location.assign("/hr/advances")} />
        <KpiCard label="Voucher Liability" value={fmtRp(home?.voucher_liability ?? 0)}
          hint={`${home?.voucher_unredeemed_count ?? 0} unredeemed`}
          icon={Ticket} color="aurora-3"
          onClick={() => window.location.assign("/hr/voucher")} />
        <KpiCard label="LB Fund Balance" value={fmtRp(home?.lb_fund_balance ?? 0)}
          hint="Loss & Breakage Fund" icon={PiggyBank} color="aurora-4"
          onClick={() => window.location.assign("/hr/lb-fund")} />
      </div>

      {(home?.pending_advance_approval > 0 || home?.service_charge_pending > 0 || home?.incentive_pending > 0) && (
        <div className="glass-card p-5 flex items-start gap-3 border-l-4 border-amber-500">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-2">Tindakan Tertunda</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {home?.pending_advance_approval > 0 && (
                <li>
                  <Link to="/hr/advances" className="hover:text-foreground" data-testid="hr-pending-adv">
                    {home.pending_advance_approval} kasbon menunggu approval →
                  </Link>
                </li>
              )}
              {home?.service_charge_pending > 0 && (
                <li>
                  <Link to="/hr/service-charge" className="hover:text-foreground" data-testid="hr-pending-sc">
                    {home.service_charge_pending} service charge belum di-post →
                  </Link>
                </li>
              )}
              {home?.incentive_pending > 0 && (
                <li>
                  <Link to="/hr/incentive" className="hover:text-foreground" data-testid="hr-pending-inc">
                    {home.incentive_pending} incentive run perlu disposisi →
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionTile to="/hr/advances?new=1" icon={Wallet} label="Buat Kasbon" testId="hr-qa-advance" />
          <ActionTile to="/hr/service-charge?new=1" icon={Receipt} label="Hitung Service" testId="hr-qa-service" />
          <ActionTile to="/hr/incentive?new=1" icon={Trophy} label="Run Incentive" testId="hr-qa-incentive" />
          <ActionTile to="/hr/voucher?new=1" icon={Ticket} label="Issue Voucher" testId="hr-qa-voucher" />
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <h3 className="font-semibold mb-2">Tips Service Charge</h3>
          <p className="text-muted-foreground">
            Service charge auto-pull dari validated daily sales. Tetapkan persen LB/LD
            kemudian alokasi otomatis berdasarkan hari kerja default 22 hari.
          </p>
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold mb-2">Payroll Cycle</h3>
          <p className="text-muted-foreground">
            Payroll mengkonsolidasi gaji + service share + incentive share − cicilan kasbon.
            Posting payroll otomatis offset advance receivable.
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionTile({ to, icon: Icon, label, testId }) {
  return (
    <Link to={to} className="glass-card-hover p-4 flex items-center gap-3" data-testid={testId}>
      <div className="h-10 w-10 rounded-xl grad-aurora-soft flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1"><div className="text-sm font-semibold">{label}</div></div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
