/** AnomalyThresholdEditor — dialog editor for anomaly_threshold_policy.
 * Sections: sales_deviation / vendor_price_spike / vendor_leadtime / ap_cash_spike.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import RuleEditorShell from "./RuleEditorShell";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Truck, Banknote } from "lucide-react";

export default function AnomalyThresholdEditor(props) {
  return (
    <RuleEditorShell
      {...props}
      variant="sheet"
      size="sm:max-w-2xl"
      renderBody={({ ruleData, setRuleData }) => {
        function setSection(section, field, value) {
          setRuleData({
            ...ruleData,
            [section]: { ...(ruleData[section] || {}), [field]: value },
          });
        }
        return (
          <div className="space-y-4">
            <Section
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Deviasi Sales Harian"
              hint="Bandingkan sales validasi dengan rolling window per outlet."
              enabled={ruleData.sales_deviation?.enabled !== false}
              onToggle={(v) => setSection("sales_deviation", "enabled", v)}
              testid="sec-sales_deviation"
            >
              <div className="grid grid-cols-2 gap-3">
                <NumField label="σ Mild" step={0.1} min={0.5}
                  value={ruleData.sales_deviation?.sigma_mild ?? 1.5}
                  onChange={(v) => setSection("sales_deviation", "sigma_mild", v)}
                  testid="sd-sigma-mild" />
                <NumField label="σ Severe" step={0.1} min={0.5}
                  value={ruleData.sales_deviation?.sigma_severe ?? 2.5}
                  onChange={(v) => setSection("sales_deviation", "sigma_severe", v)}
                  testid="sd-sigma-severe" />
                <NumField label="Window (hari)" step={1} min={3} max={90}
                  value={ruleData.sales_deviation?.window_days ?? 14}
                  onChange={(v) => setSection("sales_deviation", "window_days", Math.round(v))}
                  testid="sd-window" />
                <NumField label="Min Points" step={1} min={2}
                  value={ruleData.sales_deviation?.min_points ?? 7}
                  onChange={(v) => setSection("sales_deviation", "min_points", Math.round(v))}
                  testid="sd-min-points" />
              </div>
            </Section>

            <Section
              icon={<TrendingUp className="h-4 w-4" />}
              title="Lonjakan Harga Vendor"
              hint="Harga per unit vs rata-rata 90-hari per item per vendor."
              enabled={ruleData.vendor_price_spike?.enabled !== false}
              onToggle={(v) => setSection("vendor_price_spike", "enabled", v)}
              testid="sec-vendor_price_spike"
            >
              <div className="grid grid-cols-2 gap-3">
                <NumField label="% Mild" step={1} min={1}
                  value={ruleData.vendor_price_spike?.pct_mild ?? 15}
                  onChange={(v) => setSection("vendor_price_spike", "pct_mild", v)}
                  testid="vps-pct-mild" />
                <NumField label="% Severe" step={1} min={1}
                  value={ruleData.vendor_price_spike?.pct_severe ?? 30}
                  onChange={(v) => setSection("vendor_price_spike", "pct_severe", v)}
                  testid="vps-pct-severe" />
                <NumField label="Window (hari)" step={1} min={7} max={365}
                  value={ruleData.vendor_price_spike?.window_days ?? 90}
                  onChange={(v) => setSection("vendor_price_spike", "window_days", Math.round(v))}
                  testid="vps-window" />
              </div>
            </Section>

            <Section
              icon={<Truck className="h-4 w-4" />}
              title="Lead Time Vendor Memburuk"
              hint="Selisih hari PO→GR dibandingkan rata-rata 90-hari vendor."
              enabled={ruleData.vendor_leadtime?.enabled !== false}
              onToggle={(v) => setSection("vendor_leadtime", "enabled", v)}
              testid="sec-vendor_leadtime"
            >
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Hari Mild" step={1} min={1}
                  value={ruleData.vendor_leadtime?.days_mild ?? 3}
                  onChange={(v) => setSection("vendor_leadtime", "days_mild", v)}
                  testid="vlt-days-mild" />
                <NumField label="Hari Severe" step={1} min={1}
                  value={ruleData.vendor_leadtime?.days_severe ?? 7}
                  onChange={(v) => setSection("vendor_leadtime", "days_severe", v)}
                  testid="vlt-days-severe" />
                <NumField label="Window (hari)" step={1} min={7} max={365}
                  value={ruleData.vendor_leadtime?.window_days ?? 90}
                  onChange={(v) => setSection("vendor_leadtime", "window_days", Math.round(v))}
                  testid="vlt-window" />
              </div>
            </Section>

            <Section
              icon={<Banknote className="h-4 w-4" />}
              title="Lonjakan Pengeluaran Kas/AP"
              hint="Proyeksi kas outflow bulan ini vs rata-rata 3 bulan terakhir."
              enabled={ruleData.ap_cash_spike?.enabled !== false}
              onToggle={(v) => setSection("ap_cash_spike", "enabled", v)}
              testid="sec-ap_cash_spike"
            >
              <div className="grid grid-cols-2 gap-3">
                <NumField label="% Mild" step={1} min={1}
                  value={ruleData.ap_cash_spike?.pct_mild ?? 15}
                  onChange={(v) => setSection("ap_cash_spike", "pct_mild", v)}
                  testid="apcs-pct-mild" />
                <NumField label="% Severe" step={1} min={1}
                  value={ruleData.ap_cash_spike?.pct_severe ?? 30}
                  onChange={(v) => setSection("ap_cash_spike", "pct_severe", v)}
                  testid="apcs-pct-severe" />
              </div>
            </Section>
          </div>
        );
      }}
      renderPreview={({ ruleData }) => {
        const sd = ruleData.sales_deviation || {};
        const vps = ruleData.vendor_price_spike || {};
        const vlt = ruleData.vendor_leadtime || {};
        const apcs = ruleData.ap_cash_spike || {};
        return (
          <div className="text-xs space-y-1">
            <p>
              <strong>Sales:</strong> {sd.enabled !== false ? "On" : "Off"}{" · "}
              mild {sd.sigma_mild ?? 1.5}σ / severe {sd.sigma_severe ?? 2.5}σ · window {sd.window_days ?? 14}d
            </p>
            <p>
              <strong>Harga Vendor:</strong> {vps.enabled !== false ? "On" : "Off"}{" · "}
              mild {vps.pct_mild ?? 15}% / severe {vps.pct_severe ?? 30}% · window {vps.window_days ?? 90}d
            </p>
            <p>
              <strong>Lead Time:</strong> {vlt.enabled !== false ? "On" : "Off"}{" · "}
              mild +{vlt.days_mild ?? 3}d / severe +{vlt.days_severe ?? 7}d · window {vlt.window_days ?? 90}d
            </p>
            <p>
              <strong>Kas/AP:</strong> {apcs.enabled !== false ? "On" : "Off"}{" · "}
              mild {apcs.pct_mild ?? 15}% / severe {apcs.pct_severe ?? 30}%
            </p>
          </div>
        );
      }}
    />
  );
}

function Section({ icon, title, hint, enabled, onToggle, children, testid }) {
  return (
    <div
      className="rounded-xl border border-border/40 p-3"
      data-testid={testid}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-start gap-2">
          <div className="h-7 w-7 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              {title}
              {!enabled && <Badge variant="outline" className="text-[9px]">Off</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} data-testid={`${testid}-enabled`} />
      </div>
      {enabled && children}
    </div>
  );
}

function NumField({ label, value, onChange, step = 1, min = 0, max, testid }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        data-testid={testid}
      />
    </div>
  );
}
