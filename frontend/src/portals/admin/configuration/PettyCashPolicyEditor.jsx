/** PettyCashPolicyEditor — Dialog editor for petty_cash_policy.
 * Numeric controls + replenish frequency + receipt requirement.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import RuleEditorShell from "./RuleEditorShell";
import { fmtRp } from "@/lib/format";

const FREQ = [
  { value: "daily", label: "Harian" },
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "manual", label: "Manual" },
];

export default function PettyCashPolicyEditor(props) {
  return (
    <RuleEditorShell
      {...props}
      variant="dialog"
      size="max-w-2xl"
      renderBody={({ ruleData, setRuleData }) => {
        const monthlyLimit = Number(ruleData.monthly_limit ?? 0);
        const maxPerTxn = Number(ruleData.max_per_txn ?? 0);
        const apprThreshold = Number(ruleData.approval_threshold ?? 0);
        const freq = ruleData.replenish_frequency || "weekly";
        const requireReceipt = ruleData.require_receipt !== false;

        function set(field, value) {
          setRuleData({ ...ruleData, [field]: value });
        }

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Limit Bulanan (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  value={monthlyLimit}
                  onChange={(e) => set("monthly_limit", Number(e.target.value || 0))}
                  data-testid="pc-monthly-limit-input"
                />
                <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{fmtRp(monthlyLimit)}</p>
              </div>
              <div>
                <Label className="text-xs">Frekuensi Replenish</Label>
                <Select value={freq} onValueChange={(v) => set("replenish_frequency", v)}>
                  <SelectTrigger data-testid="pc-replenish-freq-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQ.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Maksimal per Transaksi</Label>
                <span className="text-xs font-mono tabular-nums">{fmtRp(maxPerTxn)}</span>
              </div>
              <Slider
                value={[maxPerTxn]}
                onValueChange={([v]) => set("max_per_txn", v)}
                min={0}
                max={Math.max(monthlyLimit || 5_000_000, 1_000_000)}
                step={50_000}
                data-testid="pc-max-per-txn-slider"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Butuh Approval Jika &gt; ini</Label>
                <span className="text-xs font-mono tabular-nums">{fmtRp(apprThreshold)}</span>
              </div>
              <Slider
                value={[apprThreshold]}
                onValueChange={([v]) => set("approval_threshold", v)}
                min={0}
                max={Math.max(maxPerTxn || 1_000_000, 1_000_000)}
                step={25_000}
                data-testid="pc-approval-threshold-slider"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Transaksi di atas ambang ini akan memicu workflow approval kas kecil.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
              <div>
                <Label className="text-xs">Wajib Lampiran Struk</Label>
                <p className="text-[10px] text-muted-foreground">Saat upload, sistem mengingatkan jika foto struk belum dilampirkan.</p>
              </div>
              <Switch
                checked={requireReceipt}
                onCheckedChange={(v) => set("require_receipt", v)}
                data-testid="pc-require-receipt-switch"
              />
            </div>
          </div>
        );
      }}
      renderPreview={({ ruleData }) => (
        <div className="text-xs space-y-1">
          <p>Limit kas kecil: <strong className="tabular-nums">{fmtRp(ruleData.monthly_limit || 0)}</strong> per bulan.</p>
          <p>Maks per transaksi: <strong className="tabular-nums">{fmtRp(ruleData.max_per_txn || 0)}</strong>.</p>
          <p>
            Approval otomatis untuk transaksi di atas{" "}
            <strong className="tabular-nums">{fmtRp(ruleData.approval_threshold || 0)}</strong>.
          </p>
          <p className="text-muted-foreground">
            Replenish: <span className="capitalize">{ruleData.replenish_frequency || "weekly"}</span>{" • "}
            Struk: {ruleData.require_receipt !== false ? "Wajib" : "Opsional"}
          </p>
        </div>
      )}
    />
  );
}
