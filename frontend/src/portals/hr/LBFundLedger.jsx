/** LB Fund Ledger — read-only running balance. */
import { useEffect, useState } from "react";
import { PiggyBank, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import KpiCard from "@/components/shared/KpiCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtDate } from "@/lib/format";

export default function LBFundLedger() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/hr/lb-fund", { params: { per_page: 100 } })
      .then(r => {
        setItems(unwrap(r) || []);
        setMeta(r.data?.meta || { balance: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4" data-testid="hr-lb-fund-page">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Current Balance" value={fmtRp(meta.balance ?? 0)}
          hint="L&B Fund saldo berjalan" icon={PiggyBank} color="aurora-1" />
        <KpiCard label="Total IN" value={items.filter(x => x.direction === "in").length}
          hint="Service charge deduction" icon={ArrowDownCircle} color="aurora-3" />
        <KpiCard label="Total OUT" value={items.filter(x => x.direction === "out").length}
          hint="Customer comp / breakage" icon={ArrowUpCircle} color="aurora-4" />
      </div>

      {loading ? (
        <LoadingState rows={6} />
      ) : items.length === 0 ? (
        <EmptyState icon={PiggyBank} title="Belum ada gerakan LB Fund"
          description="Saldo otomatis bertambah dari service charge L&B deduction, dan berkurang dari customer compensation." />
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-center px-4 py-3">In/Out</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">{fmtDate(it.entry_date)}</td>
                  <td className="px-4 py-3 text-xs">{it.source_type}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{it.description || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {it.direction === "in" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                        <ArrowDownCircle className="h-3.5 w-3.5" /> IN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                        <ArrowUpCircle className="h-3.5 w-3.5" /> OUT
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtRp(it.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtRp(it.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
