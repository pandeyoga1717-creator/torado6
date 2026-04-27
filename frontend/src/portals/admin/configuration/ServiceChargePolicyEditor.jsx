/** ServiceChargePolicyEditor — Dialog editor for service_charge_policy.
 * % fields + allocation method radio + live preview.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import RuleEditorShell from "./RuleEditorShell";
import { fmtRp } from "@/lib/format";

const METHODS = [
  { value: "by_days_worked", label: "Berdasarkan hari kerja", hint: "Alokasi proporsional ke setiap karyawan berdasarkan jumlah hari masuk." },
  { value: "equal", label: "Bagi rata", hint: "Setiap karyawan mendapat porsi yang sama." },
  { value: "by_role_multiplier", label: "Multiplikasi per role", hint: "Gunakan multiplier per posisi (manager 1.5x, staff 1x, dst)." },
];

export default function ServiceChargePolicyEditor(props) {
  return (
    <RuleEditorShell
      {...props}
      variant="dialog"
      size="max-w-3xl"
      renderBody={({ ruleData, setRuleData }) => {
        const sc = Number(ruleData.service_charge_pct ?? 0.05);
        const lb = Number(ruleData.lb_pct ?? 0.01);
        const ld = Number(ruleData.ld_pct ?? 0);
        const method = ruleData.allocation_method || "by_days_worked";
        const days = Number(ruleData.default_working_days ?? 22);

        function setField(f, v) { setRuleData({ ...ruleData, [f]: v }); }

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Service Charge %</Label>
                <Input
                  type="number"
                  step="0.005"
                  min={0}
                  max={1}
                  value={sc}
                  onChange={(e) => setField("service_charge_pct", Number(e.target.value || 0))}
                  data-testid="sc-service-charge-pct"
                />
                <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{(sc * 100).toFixed(2)}% dari penjualan</p>
              </div>
              <div>
                <Label className="text-xs">Potongan L&amp;B %</Label>
                <Input
                  type="number"
                  step="0.005"
                  min={0}
                  max={1}
                  value={lb}
                  onChange={(e) => setField("lb_pct", Number(e.target.value || 0))}
                  data-testid="sc-lb-pct"
                />
                <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{(lb * 100).toFixed(2)}% potongan loss/breakage</p>
              </div>
              <div>
                <Label className="text-xs">Potongan L&amp;D %</Label>
                <Input
                  type="number"
                  step="0.005"
                  min={0}
                  max={1}
                  value={ld}
                  onChange={(e) => setField("ld_pct", Number(e.target.value || 0))}
                  data-testid="sc-ld-pct"
                />
                <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{(ld * 100).toFixed(2)}% potongan loss/damage</p>
              </div>
            </div>

            <div>
              <Label className="text-xs">Metode Alokasi</Label>
              <RadioGroup
                value={method}
                onValueChange={(v) => setField("allocation_method", v)}
                className="mt-2 grid grid-cols-1 gap-2"
              >
                {METHODS.map((m) => (
                  <label
                    key={m.value}
                    htmlFor={`sc-method-${m.value}`}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer ${method === m.value ? "border-foreground/40 bg-foreground/[0.04]" : "border-border/40"}`}
                    data-testid={`sc-method-${m.value}`}
                  >
                    <RadioGroupItem id={`sc-method-${m.value}`} value={m.value} className="mt-1" />
                    <div>
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-[11px] text-muted-foreground">{m.hint}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-xs">Default Hari Kerja per Bulan</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={days}
                onChange={(e) => setField("default_working_days", Number(e.target.value || 22))}
                className="max-w-[120px]"
                data-testid="sc-days-input"
              />
            </div>

            {(lb + ld) > sc && sc > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300" data-testid="sc-warning">
                Total potongan ({((lb + ld) * 100).toFixed(2)}%) melebihi service charge ({(sc * 100).toFixed(2)}%).
              </div>
            )}
          </div>
        );
      }}
      renderPreview={({ ruleData }) => {
        const sample = 100_000_000;
        const sc = Number(ruleData.service_charge_pct ?? 0.05);
        const lb = Number(ruleData.lb_pct ?? 0.01);
        const ld = Number(ruleData.ld_pct ?? 0);
        const gross = sample * sc;
        const lbAmt = gross * lb;
        const ldAmt = gross * ld;
        const net = gross - lbAmt - ldAmt;
        return (
          <div className="text-xs font-mono space-y-1 tabular-nums" data-testid="sc-preview">
            <div>Penjualan contoh: {fmtRp(sample)}</div>
            <div>SC ({(sc * 100).toFixed(2)}%): {fmtRp(gross)}</div>
            <div>L&amp;B ({(lb * 100).toFixed(2)}%): − {fmtRp(lbAmt)}</div>
            <div>L&amp;D ({(ld * 100).toFixed(2)}%): − {fmtRp(ldAmt)}</div>
            <div className="border-t border-border/40 pt-1 mt-1">
              <strong>Net pool karyawan: {fmtRp(net)}</strong>
            </div>
          </div>
        );
      }}
    />
  );
}
