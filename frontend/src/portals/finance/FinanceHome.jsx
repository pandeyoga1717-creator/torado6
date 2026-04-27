/** Finance Home — KPIs + quick links to most used pages. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardCheck, BookOpenCheck, FileBarChart, Receipt, Scale,
  PenSquare, Wallet, ArrowRight,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import KpiCard from "@/components/shared/KpiCard";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp } from "@/lib/format";

export default function FinanceHome() {
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/finance/home").then(r => setHome(unwrap(r) || {})).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState rows={4} />;

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-1">Finance Overview</h2>
        <p className="text-sm text-muted-foreground">
          Periode aktif: <span className="font-medium text-foreground">{home?.period}</span> · jurnal otomatis dari operasional + manual JE bila perlu.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pending Validation" value={home?.submitted_validations ?? 0}
          hint="Daily sales menunggu finance" icon={ClipboardCheck} color="aurora-1"
          onClick={() => window.location.assign("/finance/validation")} />
        <KpiCard label="Journal This Period" value={home?.je_this_period ?? 0}
          hint={`Total all-time: ${home?.je_total ?? 0}`} icon={BookOpenCheck} color="aurora-2" />
        <KpiCard label="AP Exposure" value={fmtRp(home?.ap_exposure ?? 0)}
          hint="Unpaid GR" icon={Receipt} color="aurora-4" />
        <KpiCard label="Rejected DS" value={home?.rejected_count ?? 0}
          hint="Outlet perlu fix" icon={Scale} color="aurora-5" />
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionTile to="/finance/validation" icon={ClipboardCheck} label="Validate Sales" testId="fin-qa-validate" />
          <ActionTile to="/finance/manual-journal" icon={PenSquare} label="Manual JE" testId="fin-qa-manual" />
          <ActionTile to="/finance/trial-balance" icon={Scale} label="Trial Balance" testId="fin-qa-tb" />
          <ActionTile to="/finance/profit-loss" icon={FileBarChart} label="Profit & Loss" testId="fin-qa-pl" />
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <h3 className="font-semibold mb-2">Tips</h3>
          <p className="text-muted-foreground">Validasi daily sales segera setelah submit untuk menjaga TB tetap akurat. Jurnal akan terbentuk otomatis.</p>
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold mb-2">Closing Period</h3>
          <p className="text-muted-foreground">Period locking akan tersedia di Phase 6. Saat ini posting bebas tanggal.</p>
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
