/** IncentiveSchemeEditor — Sheet editor for incentive_policy.
 * rule_type tabs (pct_of_sales / flat_per_target / tiered_sales).
 */
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RuleEditorShell from "./RuleEditorShell";
import { fmtRp } from "@/lib/format";

export default function IncentiveSchemeEditor(props) {
  return (
    <RuleEditorShell
      {...props}
      variant="sheet"
      renderBody={({ ruleData, setRuleData }) => {
        const ruleType = ruleData.rule_type || "pct_of_sales";
        function set(field, value) { setRuleData({ ...ruleData, [field]: value }); }
        const eligibility = ruleData.eligibility || {};
        function setEli(field, value) {
          set("eligibility", { ...eligibility, [field]: value });
        }
        const tiers = ruleData.tiers || [];

        function tierValid(i) {
          const t = tiers[i];
          if (!t) return true;
          if (t.min_sales != null && t.max_sales != null && Number(t.min_sales) > Number(t.max_sales)) {
            return false;
          }
          for (let j = 0; j < tiers.length; j++) {
            if (j === i) continue;
            const o = tiers[j];
            if (o.min_sales == null || o.max_sales == null) continue;
            const a1 = Number(t.min_sales ?? 0), a2 = Number(t.max_sales ?? Infinity);
            const b1 = Number(o.min_sales ?? 0), b2 = Number(o.max_sales ?? Infinity);
            if (a1 <= b2 && b1 <= a2) return false;
          }
          return true;
        }

        function addTier() {
          set("tiers", [...tiers, { min_sales: 0, max_sales: 0, incentive_amount: 0, notes: "" }]);
        }

        return (
          <div className="space-y-4">
            <Tabs value={ruleType} onValueChange={(v) => set("rule_type", v)}>
              <TabsList className="grid grid-cols-3" data-testid="incentive-rule-type-tabs">
                <TabsTrigger value="pct_of_sales" data-testid="incentive-rule-pct">% Penjualan</TabsTrigger>
                <TabsTrigger value="flat_per_target" data-testid="incentive-rule-flat">Flat / Target</TabsTrigger>
                <TabsTrigger value="tiered_sales" data-testid="incentive-rule-tiered">Tier</TabsTrigger>
              </TabsList>

              <TabsContent value="pct_of_sales" className="pt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Target Penjualan (Rp)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={Number(ruleData.target_amount ?? 0)}
                      onChange={(e) => set("target_amount", Number(e.target.value || 0))}
                      data-testid="incentive-target-amount"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Insentif % dari Penjualan</Label>
                    <Input
                      type="number"
                      step="0.005"
                      min={0} max={1}
                      value={Number(ruleData.incentive_pct ?? 0.01)}
                      onChange={(e) => set("incentive_pct", Number(e.target.value || 0))}
                      data-testid="incentive-pct"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                      {((Number(ruleData.incentive_pct ?? 0.01)) * 100).toFixed(2)}% dari total penjualan.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="flat_per_target" className="pt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Target Penjualan (Rp)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={Number(ruleData.target_amount ?? 0)}
                      onChange={(e) => set("target_amount", Number(e.target.value || 0))}
                      data-testid="incentive-flat-target"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Insentif Flat (Rp)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={Number(ruleData.flat_amount ?? 0)}
                      onChange={(e) => set("flat_amount", Number(e.target.value || 0))}
                      data-testid="incentive-flat-amount"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tiered_sales" className="pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Tetapkan rentang penjualan dan nominal insentifnya. Pastikan tidak overlap.</p>
                  <Button size="sm" variant="ghost" onClick={addTier} data-testid="incentive-add-tier-btn">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Tier
                  </Button>
                </div>
                {tiers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada tier.</p>
                ) : (
                  <div className="space-y-2">
                    {tiers.map((t, i) => {
                      const valid = tierValid(i);
                      return (
                        <div
                          key={i}
                          className={`grid grid-cols-12 gap-2 items-center rounded-lg border px-2 py-1.5 ${valid ? "border-border/40" : "border-destructive/40 bg-destructive/5"}`}
                          data-testid={`incentive-tier-row-${i}`}
                        >
                          <Input
                            type="number"
                            className="col-span-3 h-8"
                            value={t.min_sales ?? 0}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...t, min_sales: Number(e.target.value || 0) };
                              set("tiers", next);
                            }}
                            placeholder="Min sales"
                          />
                          <Input
                            type="number"
                            className="col-span-3 h-8"
                            value={t.max_sales ?? 0}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...t, max_sales: Number(e.target.value || 0) };
                              set("tiers", next);
                            }}
                            placeholder="Max sales"
                          />
                          <Input
                            type="number"
                            className="col-span-3 h-8"
                            value={t.incentive_amount ?? 0}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...t, incentive_amount: Number(e.target.value || 0) };
                              set("tiers", next);
                            }}
                            placeholder="Insentif (Rp)"
                          />
                          <Input
                            className="col-span-2 h-8 text-xs"
                            value={t.notes || ""}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...t, notes: e.target.value };
                              set("tiers", next);
                            }}
                            placeholder="Notes"
                          />
                          <Button
                            size="icon" variant="ghost" className="col-span-1 h-8 w-8"
                            onClick={() => set("tiers", tiers.filter((_, j) => j !== i))}
                            data-testid={`incentive-tier-remove-${i}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          {!valid && (
                            <p className="col-span-12 text-[10px] text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Rentang tidak valid atau bentrok dengan tier lain.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="glass-card p-3 space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eligibility</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Min Hari Kerja</Label>
                  <Input
                    type="number"
                    min={0} max={31}
                    value={Number(eligibility.min_days_worked ?? 22)}
                    onChange={(e) => setEli("min_days_worked", Number(e.target.value || 0))}
                    data-testid="incentive-min-days"
                  />
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <Switch
                    checked={eligibility.exclude_probation !== false}
                    onCheckedChange={(v) => setEli("exclude_probation", v)}
                    data-testid="incentive-exclude-probation"
                  />
                  <Label className="text-xs">Tidak termasuk probation</Label>
                </div>
              </div>
            </div>
          </div>
        );
      }}
      renderPreview={({ ruleData }) => {
        const rt = ruleData.rule_type || "pct_of_sales";
        if (rt === "pct_of_sales") {
          const pct = Number(ruleData.incentive_pct ?? 0.01);
          return (
            <div className="text-xs space-y-1">
              <p>Insentif <strong className="tabular-nums">{(pct * 100).toFixed(2)}%</strong> dari total penjualan periode.</p>
              <p className="text-muted-foreground">Contoh: penjualan {fmtRp(80_000_000)} → insentif <strong>{fmtRp(80_000_000 * pct)}</strong>.</p>
            </div>
          );
        }
        if (rt === "flat_per_target") {
          return (
            <div className="text-xs space-y-1">
              <p>Jika penjualan ≥ <strong className="tabular-nums">{fmtRp(ruleData.target_amount || 0)}</strong>:</p>
              <p>→ dapat <strong className="tabular-nums">{fmtRp(ruleData.flat_amount || 0)}</strong> (flat).</p>
            </div>
          );
        }
        const tiers = ruleData.tiers || [];
        return (
          <div className="text-xs space-y-1">
            <p>{tiers.length} tier dikonfigurasi.</p>
            {tiers.slice(0, 3).map((t, i) => (
              <p key={i} className="text-muted-foreground tabular-nums">
                {fmtRp(t.min_sales || 0)} – {fmtRp(t.max_sales || 0)}: {fmtRp(t.incentive_amount || 0)}
              </p>
            ))}
          </div>
        );
      }}
    />
  );
}
