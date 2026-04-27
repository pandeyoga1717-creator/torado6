/** ApprovalWorkflows — admin page for editing multi-tier approval matrices.
 * One workflow per entity type. Tiers (amount-bracketed) → Steps (any_of_perms list).
 */
import { useEffect, useMemo, useState } from "react";
import {
  GitBranch, Plus, Edit2, Trash2, Sparkles, ChevronDown, ChevronRight,
  Save, X, Layers,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import StatusPill from "@/components/shared/StatusPill";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ApprovalWorkflows() {
  const [items, setItems] = useState([]);
  const [perms, setPerms] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [openIds, setOpenIds] = useState({});

  async function load() {
    setLoading(true);
    try {
      const [w, p, et] = await Promise.all([
        api.get("/admin/business-rules", { params: { rule_type: "approval_workflow" } }),
        api.get("/admin/permissions"),
        api.get("/admin/approval-entity-types"),
      ]);
      setItems(unwrap(w) || []);
      setPerms(unwrap(p) || []);
      setEntityTypes(unwrap(et) || []);
    } catch {
      toast.error("Gagal memuat workflows");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function seedDefaults() {
    if (!confirm("Seed default workflows? Workflow yang sudah ada untuk entity yang sama akan diarsipkan.")) return;
    try {
      setSeeding(true);
      await api.post("/admin/business-rules/seed-defaults", { overwrite: true });
      toast.success("Default workflows disusun ulang");
      load();
    } catch {
      toast.error("Gagal seed default");
    } finally { setSeeding(false); }
  }

  async function deleteRule(rule) {
    if (!confirm(`Hapus workflow untuk ${rule.rule_data?.entity_type}?`)) return;
    try {
      await api.delete(`/admin/business-rules/${rule.id}`);
      toast.success("Workflow dihapus");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal hapus");
    }
  }

  const grouped = useMemo(() => {
    const out = {};
    for (const it of items) {
      const et = it.rule_data?.entity_type || "unknown";
      out[et] = out[et] || [];
      out[et].push(it);
    }
    return out;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {items.length} workflow{items.length !== 1 ? "s" : ""} terdaftar — kelola tier amount-based + chain of approvers per entity.
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={seedDefaults} disabled={seeding}
            className="rounded-full gap-2 h-9" data-testid="wf-seed-defaults">
            <Sparkles className="h-4 w-4" /> Reset to Defaults
          </Button>
          <Button onClick={() => setEditing({ isNew: true, rule_data: blankRule() })}
            className="rounded-full pill-active gap-2 h-9" data-testid="wf-new">
            <Plus className="h-4 w-4" /> Workflow Baru
          </Button>
        </div>
      </div>

      {loading ? <LoadingState rows={6} /> : (
        items.length === 0 ? (
          <EmptyState icon={GitBranch} title="Belum ada workflow"
            description="Klik 'Reset to Defaults' untuk seed atau tambah workflow baru." />
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([entity_type, group]) => (
              <div key={entity_type} className="glass-card overflow-hidden">
                <button
                  onClick={() => setOpenIds(s => ({ ...s, [entity_type]: !s[entity_type] }))}
                  className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-foreground/5 text-left"
                  data-testid={`wf-group-${entity_type}`}>
                  {openIds[entity_type] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Layers className="h-4 w-4 text-aurora" />
                  <div className="flex-1">
                    <div className="font-semibold capitalize">{(entityTypes.find(e => e.value === entity_type)?.label) || entity_type.replaceAll("_", " ")}</div>
                    <div className="text-xs text-muted-foreground">{group.length} version{group.length > 1 ? "s" : ""} · active: {group.filter(g => g.active).length}</div>
                  </div>
                </button>
                {openIds[entity_type] && (
                  <div className="border-t border-border/50">
                    {group.map(rule => (
                      <RuleCard key={rule.id} rule={rule} entityTypes={entityTypes}
                        onEdit={() => setEditing({ ...rule })}
                        onDelete={() => deleteRule(rule)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      <WorkflowDialog
        editing={editing}
        entityTypes={entityTypes}
        permsCatalog={perms}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

function blankRule() {
  return {
    entity_type: "purchase_request",
    amount_field: null,
    tiers: [
      { min_amount: 0, max_amount: null, label: "Default tier", steps: [{ label: "Approver", any_of_perms: [] }] },
    ],
  };
}

function RuleCard({ rule, entityTypes, onEdit, onDelete }) {
  const tiers = rule.rule_data?.tiers || [];
  return (
    <div className="px-5 py-4 border-b border-border/30 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-foreground/5">v{rule.version}</span>
            <StatusPill status={rule.active ? "active" : "disabled"} />
            <span className="text-xs text-muted-foreground">{tiers.length} tier{tiers.length > 1 ? "s" : ""}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            {tiers.map((t, ti) => (
              <div key={ti} className="rounded-xl border border-border/50 p-3 bg-foreground/[0.02]">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label || `Tier ${ti + 1}`}</div>
                <div className="text-xs mt-0.5 tabular-nums">
                  {fmtRp(t.min_amount || 0)} <span className="text-muted-foreground">→</span> {t.max_amount != null ? fmtRp(t.max_amount) : <span className="text-muted-foreground">∞</span>}
                </div>
                <div className="mt-2 space-y-1">
                  {(t.steps || []).map((s, si) => (
                    <div key={si} className="flex items-center gap-2 text-xs">
                      <span className="h-5 w-5 rounded-full bg-aurora/10 text-aurora flex items-center justify-center text-[10px] font-bold">{si + 1}</span>
                      <span className="font-medium truncate">{s.label}</span>
                      <span className="text-[11px] text-muted-foreground truncate">{(s.any_of_perms || []).join(" / ") || "(any)"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={onEdit} className="h-8 w-8 rounded-lg hover:bg-foreground/5 flex items-center justify-center" data-testid={`wf-edit-${rule.id}`}>
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center" data-testid={`wf-delete-${rule.id}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkflowDialog({ editing, entityTypes, permsCatalog, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) { setForm(null); return; }
    setForm({
      isNew: !!editing.isNew,
      id: editing.id,
      rule_data: editing.rule_data ? JSON.parse(JSON.stringify(editing.rule_data)) : blankRule(),
    });
  }, [editing]);

  if (!editing || !form) return null;

  const tiers = form.rule_data.tiers || [];

  function setEntity(et) {
    setForm(s => ({ ...s, rule_data: { ...s.rule_data, entity_type: et } }));
  }
  function patchTier(ti, patch) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers[ti] = { ...next.tiers[ti], ...patch };
      return { ...s, rule_data: next };
    });
  }
  function addTier() {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      const lastMax = next.tiers.length ? next.tiers[next.tiers.length - 1].max_amount : 0;
      next.tiers.push({
        min_amount: lastMax || 0, max_amount: null, label: `Tier ${next.tiers.length + 1}`,
        steps: [{ label: "Approver", any_of_perms: [] }],
      });
      return { ...s, rule_data: next };
    });
  }
  function removeTier(ti) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers.splice(ti, 1);
      return { ...s, rule_data: next };
    });
  }
  function patchStep(ti, si, patch) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers[ti].steps[si] = { ...next.tiers[ti].steps[si], ...patch };
      return { ...s, rule_data: next };
    });
  }
  function addStep(ti) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers[ti].steps.push({ label: `Step ${next.tiers[ti].steps.length + 1}`, any_of_perms: [] });
      return { ...s, rule_data: next };
    });
  }
  function removeStep(ti, si) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers[ti].steps.splice(si, 1);
      return { ...s, rule_data: next };
    });
  }

  async function save() {
    // Validation
    if (!form.rule_data.entity_type) { toast.error("Pilih entity type"); return; }
    if (!tiers.length) { toast.error("Minimal 1 tier"); return; }
    for (const t of tiers) {
      if (!(t.steps || []).length) { toast.error("Setiap tier harus punya minimal 1 step"); return; }
    }
    try {
      setSaving(true);
      if (form.isNew) {
        await api.post("/admin/business-rules", {
          rule_type: "approval_workflow",
          scope_type: "group",
          scope_id: "*",
          rule_data: form.rule_data,
        });
        toast.success("Workflow dibuat");
      } else {
        await api.patch(`/admin/business-rules/${form.id}`, {
          rule_data: form.rule_data,
        });
        toast.success("Workflow diperbarui");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-card max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.isNew ? "Workflow Baru" : "Edit Workflow"}</DialogTitle>
          <DialogDescription>
            Definisikan tier amount-based + multi-step approver per entity type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entity type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Entity Type</Label>
              <select value={form.rule_data.entity_type}
                disabled={!form.isNew}
                onChange={e => setEntity(e.target.value)}
                className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
                data-testid="wf-entity-type">
                {entityTypes.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
              </select>
              {!form.isNew && (
                <p className="text-[11px] text-muted-foreground mt-1">Entity type tidak dapat diubah setelah dibuat. Buat workflow baru jika perlu beralih.</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Amount Field (opsional)</Label>
              <Input value={form.rule_data.amount_field || ""}
                onChange={e => setForm(s => ({ ...s, rule_data: { ...s.rule_data, amount_field: e.target.value || null } }))}
                placeholder="auto-compute jika kosong" className="glass-input mt-1 h-10" data-testid="wf-amount-field" />
            </div>
          </div>

          {/* Tiers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Tiers ({tiers.length})</Label>
              <Button onClick={addTier} variant="outline" className="rounded-full gap-1 h-8" data-testid="wf-add-tier">
                <Plus className="h-3.5 w-3.5" /> Tambah Tier
              </Button>
            </div>
            {tiers.map((t, ti) => (
              <div key={ti} className="glass-input rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Label</Label>
                    <Input value={t.label || ""} onChange={e => patchTier(ti, { label: e.target.value })}
                      className="bg-background mt-1 h-9" data-testid={`wf-tier-label-${ti}`} />
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Min Amount (Rp)</Label>
                    <Input type="number" value={t.min_amount ?? 0}
                      onChange={e => patchTier(ti, { min_amount: Number(e.target.value) })}
                      className="bg-background mt-1 h-9 tabular-nums" data-testid={`wf-tier-min-${ti}`} />
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Max Amount (kosong = ∞)</Label>
                    <Input type="number" value={t.max_amount ?? ""}
                      onChange={e => patchTier(ti, { max_amount: e.target.value === "" ? null : Number(e.target.value) })}
                      className="bg-background mt-1 h-9 tabular-nums" data-testid={`wf-tier-max-${ti}`} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => removeTier(ti)} variant="outline"
                      className="rounded-full gap-1 h-9 text-red-600 w-full" disabled={tiers.length <= 1} data-testid={`wf-tier-remove-${ti}`}>
                      <Trash2 className="h-3.5 w-3.5" /> Hapus Tier
                    </Button>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Approval Steps ({(t.steps || []).length})</div>
                    <Button onClick={() => addStep(ti)} variant="outline" size="sm"
                      className="rounded-full gap-1 h-7 text-xs" data-testid={`wf-add-step-${ti}`}>
                      <Plus className="h-3 w-3" /> Step
                    </Button>
                  </div>
                  {(t.steps || []).map((s, si) => (
                    <StepEditor key={si} step={s} stepIdx={si}
                      permsCatalog={permsCatalog}
                      onChange={(p) => patchStep(ti, si, p)}
                      onRemove={() => removeStep(ti, si)}
                      removable={(t.steps || []).length > 1}
                      tIdx={ti} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="gap-2"><X className="h-4 w-4" /> Batal</Button>
          <Button onClick={save} disabled={saving} className="pill-active gap-2" data-testid="wf-save">
            <Save className="h-4 w-4" /> {form.isNew ? "Buat" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepEditor({ step, stepIdx, permsCatalog, onChange, onRemove, removable, tIdx }) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => {
    const m = {};
    for (const p of permsCatalog) {
      m[p.category] = m[p.category] || [];
      m[p.category].push(p);
    }
    return m;
  }, [permsCatalog]);

  return (
    <div className="bg-background rounded-lg border border-border/40 p-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Step {stepIdx + 1} — Label</Label>
          <Input value={step.label || ""} onChange={e => onChange({ label: e.target.value })}
            className="bg-foreground/[0.02] mt-1 h-9" data-testid={`wf-step-label-${tIdx}-${stepIdx}`} />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen(o => !o)}
            className="flex-1 rounded-lg border border-border/50 px-3 h-9 text-xs flex items-center gap-2 bg-foreground/[0.02] hover:bg-foreground/[0.05]"
            data-testid={`wf-step-perms-toggle-${tIdx}-${stepIdx}`}>
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>{(step.any_of_perms || []).length} permission(s)</span>
            <span className="ml-auto text-muted-foreground truncate max-w-[160px]">{(step.any_of_perms || []).join(", ") || "any"}</span>
          </button>
          {removable && (
            <button type="button" onClick={onRemove}
              className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center" data-testid={`wf-step-remove-${tIdx}-${stepIdx}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-2">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{cat}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {list.map(p => {
                  const checked = (step.any_of_perms || []).includes(p.code);
                  return (
                    <label key={p.code} className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer",
                      checked ? "bg-aurora/10" : "hover:bg-foreground/5",
                    )}>
                      <Checkbox checked={checked}
                        onCheckedChange={(v) => {
                          const set = new Set(step.any_of_perms || []);
                          if (v) set.add(p.code); else set.delete(p.code);
                          onChange({ any_of_perms: Array.from(set) });
                        }} />
                      <span className="truncate flex-1">{p.label}</span>
                      <code className="text-[10px] text-muted-foreground truncate">{p.code}</code>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
