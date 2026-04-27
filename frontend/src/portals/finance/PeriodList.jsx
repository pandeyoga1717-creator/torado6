/** PeriodList — table of accounting periods with status pills + lock/unlock/wizard actions. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Unlock, ListChecks, CalendarRange, RefreshCw } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function PeriodList() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [unlockDlg, setUnlockDlg] = useState(null); // {period}
  const [unlockReason, setUnlockReason] = useState("");
  const [acting, setActing] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/periods", { params: { year } });
      setItems(unwrap(res) || []);
    } catch {
      toast.error("Gagal memuat periods");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year]);

  async function lock(period) {
    if (!confirm(`Lock period ${period}? Setelah locked, jurnal di period ini tidak bisa di-post.`)) return;
    try {
      setActing(period);
      await api.post(`/finance/periods/${period}/lock`, { reason: "Lock from period list" });
      toast.success(`Period ${period} locked`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal lock");
    } finally { setActing(""); }
  }

  async function close(period) {
    if (!confirm(`Close period ${period}? Soft-close (masih bisa di-reopen).`)) return;
    try {
      setActing(period);
      await api.post(`/finance/periods/${period}/close`, { reason: "Close from period list" });
      toast.success(`Period ${period} closed`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal close");
    } finally { setActing(""); }
  }

  async function submitUnlock() {
    if (!unlockReason.trim()) { toast.error("Alasan wajib"); return; }
    try {
      setActing(unlockDlg.period);
      await api.post(`/finance/periods/${unlockDlg.period}/unlock`, { reason: unlockReason.trim() });
      toast.success(`Period ${unlockDlg.period} reopened`);
      setUnlockDlg(null); setUnlockReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal unlock");
    } finally { setActing(""); }
  }

  const canClose = can("finance.period.close_step");
  const canLock = can("finance.period.lock");
  const canUnlock = can("finance.period.unlock");

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[120px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Tahun</Label>
          <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="glass-input mt-1 h-9" data-testid="period-year" />
        </div>
        <Button variant="outline" onClick={load} className="rounded-full gap-2 h-10" data-testid="period-refresh">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
        <div className="ml-auto text-xs text-muted-foreground hidden md:block">
          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 mr-1">open</span> dapat di-posting
          <span className="mx-2">·</span>
          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 mr-1">closed</span> soft-close
          <span className="mx-2">·</span>
          <span className="inline-block px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 mr-1">locked</span> hard-lock
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-border/50">
              <Th>Period</Th>
              <Th>Status</Th>
              <Th>Locked / Closed</Th>
              <Th>Last Update</Th>
              <Th className="text-right">Aksi</Th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="p-6"><LoadingState rows={6} /></td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon={CalendarRange} title="Belum ada period" description="Periods akan auto-create saat ada JE pertama." /></td></tr>
              )}
              {!loading && items.map(p => (
                <tr key={p.period} className="border-b border-border/30 hover:bg-foreground/5" data-testid={`period-row-${p.period}`}>
                  <td className="px-5 py-3 font-mono font-semibold">{p.period}</td>
                  <td className="px-5 py-3"><StatusPill status={p.status} /></td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {p.locked_at && <div>🔒 {fmtDateTime(p.locked_at)}</div>}
                    {p.closed_at && !p.locked_at && <div>🔐 {fmtDateTime(p.closed_at)}</div>}
                    {!p.locked_at && !p.closed_at && "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{fmtDateTime(p.updated_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Link to={`/finance/period-closing/${p.period}`}>
                        <Button size="sm" variant="outline" className="rounded-full gap-1 h-8" data-testid={`period-wizard-${p.period}`}>
                          <ListChecks className="h-3.5 w-3.5" /> Wizard
                        </Button>
                      </Link>
                      {p.status === "open" && canClose && (
                        <Button size="sm" variant="outline" disabled={acting === p.period} onClick={() => close(p.period)}
                          className="rounded-full gap-1 h-8" data-testid={`period-close-${p.period}`}>
                          Close
                        </Button>
                      )}
                      {(p.status === "open" || p.status === "closed") && canLock && (
                        <Button size="sm" disabled={acting === p.period} onClick={() => lock(p.period)}
                          className="pill-active rounded-full gap-1 h-8" data-testid={`period-lock-${p.period}`}>
                          <Lock className="h-3.5 w-3.5" /> Lock
                        </Button>
                      )}
                      {(p.status === "locked" || p.status === "closed") && canUnlock && (
                        <Button size="sm" variant="outline" disabled={acting === p.period}
                          onClick={() => { setUnlockDlg({ period: p.period }); setUnlockReason(""); }}
                          className="rounded-full gap-1 h-8 text-amber-700" data-testid={`period-unlock-${p.period}`}>
                          <Unlock className="h-3.5 w-3.5" /> Reopen
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!unlockDlg} onOpenChange={(v) => !v && setUnlockDlg(null)}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Reopen Period {unlockDlg?.period}?</DialogTitle>
            <DialogDescription>
              Reopen akan mengembalikan period ke status <b>open</b> sehingga jurnal dapat di-posting kembali. Aksi ini tercatat pada audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Alasan reopen</Label>
            <Textarea value={unlockReason} onChange={e => setUnlockReason(e.target.value)}
              placeholder="Mis: koreksi adjustment, tambah jurnal terlewat…"
              className="glass-input min-h-[100px]" data-testid="period-unlock-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockDlg(null)}>Batal</Button>
            <Button onClick={submitUnlock} className="pill-active" data-testid="period-unlock-confirm">Reopen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
