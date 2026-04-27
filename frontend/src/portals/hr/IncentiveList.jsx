/** Incentive — schemes + runs (calculate / approve / post). */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus, Trophy, Calculator, ArrowUpCircle, CheckCircle2,
} from "lucide-react";
import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function IncentiveList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("runs");
  const [schemes, setSchemes] = useState([]);
  const [runs, setRuns] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSchemeForm, setShowSchemeForm] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [detailRunId, setDetailRunId] = useState(null);

  const canApprove = (user?.permissions || []).includes("hr.incentive.approve")
    || (user?.permissions || []).includes("*");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCalc(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api.get("/hr/incentive-schemes"),
        api.get("/hr/incentive-runs"),
      ]);
      setSchemes(unwrap(s) || []);
      setRuns(unwrap(r) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get("/master/employees", { params: { per_page: 200 } }),
      api.get("/master/outlets", { params: { per_page: 100 } }),
    ]).then(([e, o]) => {
      setEmployees((unwrap(e) || []).filter(x => x.status === "active"));
      setOutlets(unwrap(o) || []);
    }).catch(() => {});
    load();
  }, []);

  return (
    <div className="space-y-4" data-testid="hr-incentive-page">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="runs" data-testid="hr-inc-tab-runs">Runs</TabsTrigger>
            <TabsTrigger value="schemes" data-testid="hr-inc-tab-schemes">Schemes</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {tab === "schemes" && (
              <Button onClick={() => setShowSchemeForm(true)} className="rounded-full"
                      data-testid="hr-inc-scheme-create">
                <Plus className="h-4 w-4 mr-2" /> New Scheme
              </Button>
            )}
            {tab === "runs" && (
              <Button onClick={() => setShowCalc(true)} className="rounded-full"
                      data-testid="hr-inc-calc-btn">
                <Calculator className="h-4 w-4 mr-2" /> Run Calculation
              </Button>
            )}
          </div>
        </div>
        <TabsContent value="runs" className="mt-4">
          {loading ? <LoadingState rows={5} />
           : runs.length === 0 ? (
             <EmptyState icon={Trophy} title="Belum ada incentive run"
              description="Tekan Run Calculation untuk men-generate incentive berdasarkan scheme." />
           ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3">Doc No</th>
                    <th className="text-left px-4 py-3">Period</th>
                    <th className="text-left px-4 py-3">Scheme</th>
                    <th className="text-right px-4 py-3">Base Sales</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                         onClick={() => setDetailRunId(r.id)}
                         data-testid={`hr-inc-run-row-${r.id}`}>
                      <td className="px-4 py-3 font-mono text-xs">{r.doc_no}</td>
                      <td className="px-4 py-3 font-mono">{r.period}</td>
                      <td className="px-4 py-3">{r.scheme_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtRp(r.base_sales)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtRp(r.total_amount)}</td>
                      <td className="px-4 py-3 text-center"><StatusPill status={r.status} /></td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {canApprove && r.status !== "posted" && r.total_amount > 0 && (
                          <Button size="sm" variant="default" className="rounded-full"
                                  onClick={async () => {
                                    try {
                                      await api.post(`/hr/incentive-runs/${r.id}/post`);
                                      toast.success("Incentive di-post");
                                      await load();
                                    } catch (e) { toast.error(unwrapError(e)); }
                                  }}
                                  data-testid={`hr-inc-post-${r.id}`}>
                            <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Post
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
           )}
        </TabsContent>
        <TabsContent value="schemes" className="mt-4">
          {loading ? <LoadingState rows={5} />
           : schemes.length === 0 ? (
             <EmptyState icon={Trophy} title="Belum ada incentive scheme"
               description="Buat scheme dengan rule (pct_of_sales / flat_per_target / tiered_sales)." />
           ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Scope</th>
                    <th className="text-left px-4 py-3">Rule Type</th>
                    <th className="text-center px-4 py-3">Employees</th>
                    <th className="text-center px-4 py-3">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {schemes.map(s => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 font-mono">{s.code}</td>
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {s.scope_type}{s.scope_id ? `: ${(outlets.find(o => o.id === s.scope_id)?.name || s.scope_id.slice(0,8))}` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs">{s.rule_type}</td>
                      <td className="px-4 py-3 text-center">{s.employee_ids?.length || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusPill status={s.active ? "active" : "disabled"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
           )}
        </TabsContent>
      </Tabs>

      <SchemeFormDialog open={showSchemeForm} onOpenChange={setShowSchemeForm}
        employees={employees} outlets={outlets}
        onCreated={async () => { setShowSchemeForm(false); await load(); }} />
      <RunCalcDialog open={showCalc} onOpenChange={setShowCalc}
        schemes={schemes}
        onCalculated={async () => { setShowCalc(false); await load(); }} />
      <RunDetailDialog runId={detailRunId} open={!!detailRunId}
        onOpenChange={(v) => !v && setDetailRunId(null)}
        canApprove={canApprove}
        onPosted={async () => { setDetailRunId(null); await load(); }} />
    </div>
  );
}

function SchemeFormDialog({ open, onOpenChange, employees, outlets, onCreated }) {
  const [form, setForm] = useState({
    code: "", name: "", scope_type: "global", scope_id: "",
    rule_type: "pct_of_sales", pct: 0.01, target_sales: 0, flat_amount: 0,
    employee_ids: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.code || !form.name) return toast.error("Code & name wajib");
    let rule_data = {};
    if (form.rule_type === "pct_of_sales") rule_data = { pct: Number(form.pct) || 0 };
    if (form.rule_type === "flat_per_target") rule_data = {
      target_sales: Number(form.target_sales) || 0,
      flat_amount: Number(form.flat_amount) || 0,
    };
    setSubmitting(true);
    try {
      await api.post("/hr/incentive-schemes", {
        code: form.code, name: form.name,
        scope_type: form.scope_type,
        scope_id: form.scope_id || undefined,
        rule_type: form.rule_type,
        rule_data,
        employee_ids: form.employee_ids,
      });
      toast.success("Scheme dibuat");
      await onCreated();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEmp = (id) => {
    setForm(f => ({
      ...f,
      employee_ids: f.employee_ids.includes(id)
        ? f.employee_ids.filter(x => x !== id)
        : [...f.employee_ids, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" data-testid="hr-inc-scheme-dialog">
        <DialogHeader>
          <DialogTitle>Incentive Scheme Baru</DialogTitle>
          <DialogDescription>Tetapkan rule + daftar karyawan target.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="PCT-1" data-testid="hr-inc-scheme-code" />
            </div>
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="1% of Sales" data-testid="hr-inc-scheme-name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Scope Type</Label>
              <Select value={form.scope_type} onValueChange={(v) => setForm(f => ({ ...f, scope_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="outlet">Outlet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope_type === "outlet" && (
              <div className="space-y-1">
                <Label>Outlet</Label>
                <Select value={form.scope_id} onValueChange={(v) => setForm(f => ({ ...f, scope_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
                  <SelectContent>
                    {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Rule Type</Label>
            <Select value={form.rule_type} onValueChange={(v) => setForm(f => ({ ...f, rule_type: v }))}>
              <SelectTrigger data-testid="hr-inc-scheme-rule-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pct_of_sales">% of sales</SelectItem>
                <SelectItem value="flat_per_target">Flat per target</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.rule_type === "pct_of_sales" && (
            <div className="space-y-1">
              <Label>Persentase (decimal, e.g. 0.01)</Label>
              <Input type="number" min="0" max="1" step="0.001" value={form.pct}
                      onChange={(e) => setForm(f => ({ ...f, pct: e.target.value }))}
                      data-testid="hr-inc-scheme-pct" />
            </div>
          )}
          {form.rule_type === "flat_per_target" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Target Sales</Label>
                <Input type="number" value={form.target_sales}
                        onChange={(e) => setForm(f => ({ ...f, target_sales: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Flat Amount</Label>
                <Input type="number" value={form.flat_amount}
                        onChange={(e) => setForm(f => ({ ...f, flat_amount: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label>Karyawan ({form.employee_ids.length} dipilih)</Label>
            <div className="glass-card-hover p-2 max-h-48 overflow-y-auto space-y-1"
                  data-testid="hr-inc-scheme-emp-picker">
              {employees.map(e => (
                <label key={e.id} className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded cursor-pointer">
                  <input type="checkbox" checked={form.employee_ids.includes(e.id)}
                          onChange={() => toggleEmp(e.id)} />
                  <span className="text-sm">{e.full_name} <span className="text-xs text-muted-foreground">({e.code})</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-full"
                  data-testid="hr-inc-scheme-submit">
            {submitting ? "Menyimpan…" : "Simpan Scheme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunCalcDialog({ open, onOpenChange, schemes, onCalculated }) {
  const [form, setForm] = useState({ scheme_id: "", period: currentPeriod() });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.scheme_id) return toast.error("Pilih scheme");
    setSubmitting(true);
    try {
      await api.post("/hr/incentive-runs/calculate", {
        scheme_id: form.scheme_id, period: form.period,
      });
      toast.success("Incentive dihitung");
      await onCalculated();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="hr-inc-calc-dialog">
        <DialogHeader>
          <DialogTitle>Run Incentive Calculation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Scheme *</Label>
            <Select value={form.scheme_id} onValueChange={(v) => setForm(f => ({ ...f, scheme_id: v }))}>
              <SelectTrigger data-testid="hr-inc-calc-scheme"><SelectValue placeholder="Pilih scheme" /></SelectTrigger>
              <SelectContent>
                {schemes.map(s => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Period</Label>
            <Input type="month" value={form.period}
                    onChange={(e) => setForm(f => ({ ...f, period: e.target.value }))}
                    data-testid="hr-inc-calc-period" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-full"
                  data-testid="hr-inc-calc-submit">
            {submitting ? "Menghitung…" : "Hitung"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunDetailDialog({ runId, open, onOpenChange, canApprove, onPosted }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!runId) { setData(null); return; }
    api.get(`/hr/incentive-runs/${runId}`).then(r => setData(unwrap(r))).catch(() => {});
  }, [runId]);

  const handlePost = async () => {
    setBusy(true);
    try {
      await api.post(`/hr/incentive-runs/${runId}/post`);
      toast.success("Posted ke jurnal");
      await onPosted();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="hr-inc-run-detail">
        <DialogHeader>
          <DialogTitle>Incentive Run Detail</DialogTitle>
          {data && (
            <DialogDescription>
              {data.scheme_name} · Period <span className="font-mono">{data.period}</span> · <StatusPill status={data.status} />
            </DialogDescription>
          )}
        </DialogHeader>
        {!data ? (<LoadingState rows={5} />) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card-hover p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Base Sales</div>
                <div className="text-base font-bold tabular-nums">{fmtRp(data.base_sales)}</div>
              </div>
              <div className="glass-card p-3 ring-1 ring-aurora">
                <div className="text-[11px] uppercase text-muted-foreground">Total Incentive</div>
                <div className="text-base font-bold tabular-nums">{fmtRp(data.total_amount)}</div>
              </div>
            </div>
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="text-left px-3 py-2">Karyawan</th>
                    <th className="text-left px-3 py-2">Formula</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.allocations || []).map((a, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="px-3 py-2">{a.employee_name || a.employee_id?.slice(0,8)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{a.formula_detail}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtRp(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
          {canApprove && data && data.status !== "posted" && data.total_amount > 0 && (
            <Button onClick={handlePost} disabled={busy} className="rounded-full"
                    data-testid="hr-inc-detail-post">
              {busy ? "Posting…" : "Post ke Journal"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
