/** Shared editor shell used by all 4 self-service rule editors.
 * Wraps a Sheet (default) or Dialog (compact) with header + footer +
 * scope/effective-dating fields, and slots a custom editor body.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, X, Save, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";

import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RULE_LABELS } from "./configHelpers";

export default function RuleEditorShell({
  variant = "sheet", // 'sheet' | 'dialog'
  size = "max-w-3xl",
  open,
  onClose,
  rule, // {id?, rule_type, scope_type, scope_id, rule_data, name, ...}
  scope, // {scope_type, scope_id}
  onSaved,
  renderBody, // ({ ruleData, setRuleData, errors }) => JSX
  renderPreview, // ({ ruleData }) => JSX
}) {
  const isEdit = !!rule?.id;
  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [effFrom, setEffFrom] = useState(rule?.effective_from || "");
  const [effTo, setEffTo] = useState(rule?.effective_to || "");
  const [ruleData, setRuleData] = useState(rule?.rule_data || {});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverWarn, setServerWarn] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(rule?.name || "");
    setDescription(rule?.description || "");
    setActive(rule?.active ?? true);
    setEffFrom(rule?.effective_from || "");
    setEffTo(rule?.effective_to || "");
    setRuleData(rule?.rule_data || {});
    setErrors({});
    setServerWarn("");
  }, [open, rule]);

  const ruleTypeLabel = useMemo(
    () => RULE_LABELS[rule?.rule_type] || rule?.rule_type || "",
    [rule?.rule_type],
  );

  function validate() {
    const errs = {};
    if (!name.trim()) errs.name = "Nama wajib diisi";
    if (effFrom && effTo && effFrom > effTo) errs.effective_to = "Tanggal akhir tidak boleh sebelum tanggal mulai";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save() {
    if (!validate()) {
      toast.error("Periksa kembali isian aturan");
      return;
    }
    const payload = {
      rule_type: rule.rule_type,
      scope_type: scope.scope_type,
      scope_id: scope.scope_id,
      rule_data: ruleData,
      name,
      description,
      active,
      effective_from: effFrom || null,
      effective_to: effTo || null,
    };
    setSaving(true); setServerWarn("");
    try {
      let res;
      if (isEdit) {
        res = await api.patch(`/admin/business-rules/${rule.id}`, payload);
      } else {
        res = await api.post("/admin/business-rules", payload);
      }
      const created = unwrap(res);
      if (created?.overlaps_with?.length > 0) {
        toast.warning("Aturan disimpan, namun ada bentrok periode dengan versi lain");
      } else {
        toast.success(isEdit ? "Perubahan disimpan" : "Aturan dibuat");
      }
      onSaved?.(created);
    } catch (e) {
      const msg = unwrapError(e);
      setServerWarn(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const Body = (
    <div className="flex flex-col gap-5 pb-3">
      {serverWarn && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <span data-testid="config-editor-server-warning">{serverWarn}</span>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Identitas</h4>
          <span className="text-[11px] text-muted-foreground">
            Scope: <span className="font-mono">{scope.scope_type}</span> / <span className="font-mono">{scope.scope_id}</span>
          </span>
        </div>
        <div>
          <Label htmlFor="rule-name" className="text-xs">Nama Aturan</Label>
          <Input
            id="rule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Contoh: ${ruleTypeLabel} — Outlet Senayan`}
            data-testid="config-editor-name-input"
          />
          {errors.name && <p className="text-[11px] text-destructive mt-1">{errors.name}</p>}
        </div>
        <div>
          <Label htmlFor="rule-desc" className="text-xs">Deskripsi (opsional)</Label>
          <Textarea
            id="rule-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Catatan singkat untuk tim…"
            data-testid="config-editor-description-input"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" /> Periode Berlaku
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Mulai</Label>
            <Input
              type="date"
              value={effFrom || ""}
              onChange={(e) => setEffFrom(e.target.value)}
              data-testid="config-editor-effective-from-input"
            />
          </div>
          <div>
            <Label className="text-xs">Berakhir</Label>
            <Input
              type="date"
              value={effTo || ""}
              onChange={(e) => setEffTo(e.target.value)}
              data-testid="config-editor-effective-to-input"
            />
            {errors.effective_to && <p className="text-[11px] text-destructive mt-1">{errors.effective_to}</p>}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Kosongkan untuk berlaku tanpa batas.</p>
        <div className="flex items-center gap-2 pt-1">
          <Switch
            id="rule-active"
            checked={active}
            onCheckedChange={setActive}
            data-testid="config-editor-active-switch"
          />
          <Label htmlFor="rule-active" className="text-xs">
            {active ? "Aktif (akan diberlakukan sesuai jadwal)" : "Diarsipkan (tidak diberlakukan)"}
          </Label>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Konfigurasi {ruleTypeLabel}</h4>
        {renderBody?.({ ruleData, setRuleData, errors })}
      </section>

      {renderPreview && (
        <section className="space-y-2" data-testid="config-editor-preview-panel">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4" /> Preview
          </h4>
          <div className="rounded-xl border border-border/50 grad-aurora-soft p-3">
            {renderPreview({ ruleData })}
          </div>
        </section>
      )}
    </div>
  );

  const Footer = (
    <div className="flex items-center justify-between border-t border-border/40 pt-3 mt-3">
      <div className="text-[11px] text-muted-foreground">
        {isEdit ? `v${rule.version || "?"} — ID: ${rule.id?.slice(0, 8)}…` : "Aturan baru"}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving} data-testid="config-editor-cancel-btn">Batal</Button>
        <Button onClick={save} disabled={saving} className="rounded-full" data-testid="config-editor-save-schedule-button">
          <Save className="h-3.5 w-3.5 mr-1" />
          {saving ? "Menyimpan…" : (isEdit ? "Simpan Perubahan" : "Simpan & Jadwalkan")}
        </Button>
      </div>
    </div>
  );

  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
        <DialogContent className={cn("glass-card max-h-[88vh] overflow-y-auto", size)} data-testid="config-editor-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEdit ? "Edit" : "Buat"} {ruleTypeLabel}
              <button onClick={onClose} className="ml-auto rounded-full p-1 hover:bg-foreground/[0.05]" aria-label="Tutup">
                <X className="h-3.5 w-3.5" />
              </button>
            </DialogTitle>
            <DialogDescription>Atur kebijakan dan periode berlaku.</DialogDescription>
          </DialogHeader>
          {Body}
          {Footer}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose?.()}>
      <SheetContent
        side="right"
        className={cn("glass-card !w-full sm:!w-[640px] sm:!max-w-[640px] overflow-y-auto")}
        data-testid="config-editor-dialog"
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit" : "Buat"} {ruleTypeLabel}</SheetTitle>
          <SheetDescription>Atur kebijakan dan periode berlaku.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {Body}
          {Footer}
        </div>
      </SheetContent>
    </Sheet>
  );
}
