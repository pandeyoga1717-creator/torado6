/** SalesSchemaEditor — Sheet editor for sales_input_schema rule.
 * 4 builder blocks: channels (reorderable), payment methods (toggle list),
 * revenue buckets (table), validation rules (accordion).
 */
import { GripVertical, Plus, Trash2, Tag, CreditCard, Layers, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import RuleEditorShell from "./RuleEditorShell";

const SEVERITIES = [
  { value: "warning", label: "Peringatan" },
  { value: "error", label: "Error (blok submit)" },
];

function Reorderable({ items, onChange, renderItem }) {
  function move(idx, dir) {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={it.code || i} className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-2 py-1.5">
          <button
            type="button"
            onClick={() => move(i, -1)}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            disabled={i === 0}
            title="Naik"
            data-testid={`channel-up-${it.code}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1 min-w-0">{renderItem(it, i)}</div>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive p-1 rounded"
            title="Hapus"
            data-testid={`channel-remove-${it.code}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function SalesSchemaEditor(props) {
  return (
    <RuleEditorShell
      {...props}
      variant="sheet"
      renderBody={({ ruleData, setRuleData }) => {
        const channels = ruleData.channels || [];
        const paymentMethods = ruleData.payment_methods || [];
        const buckets = ruleData.revenue_buckets || [];
        const validations = ruleData.validation_rules || [];

        function addChannel() {
          const code = (prompt("Kode channel (mis: GOFOOD)") || "").trim().toUpperCase();
          if (!code) return;
          setRuleData({ ...ruleData, channels: [...channels, { code, name: code, active: true }] });
        }

        function addPayment() {
          const code = (prompt("Kode metode bayar (mis: QRIS)") || "").trim().toUpperCase();
          if (!code) return;
          setRuleData({ ...ruleData, payment_methods: [...paymentMethods, { code, name: code, active: true }] });
        }

        function addBucket() {
          setRuleData({
            ...ruleData,
            revenue_buckets: [...buckets, { code: `B${buckets.length + 1}`, name: "", required: false }],
          });
        }

        function addValidation() {
          setRuleData({
            ...ruleData,
            validation_rules: [
              ...validations,
              { id: `rule_${validations.length + 1}`, label: "", severity: "warning", active: true },
            ],
          });
        }

        return (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Channel Penjualan
                </h5>
                <Button variant="ghost" size="sm" onClick={addChannel} data-testid="sales-add-channel-btn">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                </Button>
              </div>
              {channels.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada channel. Tambahkan ‘Dine-in’ atau ‘GoFood’.</p>
              ) : (
                <Reorderable
                  items={channels}
                  onChange={(next) => setRuleData({ ...ruleData, channels: next })}
                  renderItem={(c, i) => (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-foreground/[0.05]">{c.code}</span>
                      <Input
                        value={c.name}
                        onChange={(e) => {
                          const next = [...channels];
                          next[i] = { ...c, name: e.target.value };
                          setRuleData({ ...ruleData, channels: next });
                        }}
                        className="h-8"
                        placeholder="Nama channel…"
                        data-testid={`channel-name-${c.code}`}
                      />
                      <Switch
                        checked={c.active !== false}
                        onCheckedChange={(v) => {
                          const next = [...channels];
                          next[i] = { ...c, active: v };
                          setRuleData({ ...ruleData, channels: next });
                        }}
                        data-testid={`channel-active-${c.code}`}
                      />
                    </div>
                  )}
                />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Metode Pembayaran
                </h5>
                <Button variant="ghost" size="sm" onClick={addPayment} data-testid="sales-add-payment-btn">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                </Button>
              </div>
              <div className="flex flex-wrap gap-2" data-testid="sales-payment-list">
                {paymentMethods.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tambahkan metode bayar (Cash, QRIS, dll).</p>
                ) : paymentMethods.map((pm, i) => (
                  <button
                    key={pm.code}
                    type="button"
                    onClick={() => {
                      const next = [...paymentMethods];
                      next[i] = { ...pm, active: !pm.active };
                      setRuleData({ ...ruleData, payment_methods: next });
                    }}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs border ${pm.active !== false ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border/50 bg-foreground/[0.03] text-muted-foreground"}`}
                    data-testid={`payment-toggle-${pm.code}`}
                  >
                    <span className="font-mono text-[10px]">{pm.code}</span>
                    <span>{pm.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Bucket Pendapatan
                </h5>
                <Button variant="ghost" size="sm" onClick={addBucket} data-testid="sales-add-bucket-btn">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                </Button>
              </div>
              {buckets.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada bucket. Contoh: Food, Beverage.</p>
              ) : (
                <div className="space-y-2">
                  {buckets.map((b, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-3 h-8 font-mono text-xs"
                        value={b.code}
                        onChange={(e) => {
                          const next = [...buckets];
                          next[i] = { ...b, code: e.target.value.toUpperCase() };
                          setRuleData({ ...ruleData, revenue_buckets: next });
                        }}
                        placeholder="CODE"
                        data-testid={`bucket-code-${i}`}
                      />
                      <Input
                        className="col-span-6 h-8"
                        value={b.name}
                        onChange={(e) => {
                          const next = [...buckets];
                          next[i] = { ...b, name: e.target.value };
                          setRuleData({ ...ruleData, revenue_buckets: next });
                        }}
                        placeholder="Nama bucket…"
                        data-testid={`bucket-name-${i}`}
                      />
                      <div className="col-span-2 flex items-center gap-2">
                        <Switch
                          checked={!!b.required}
                          onCheckedChange={(v) => {
                            const next = [...buckets];
                            next[i] = { ...b, required: v };
                            setRuleData({ ...ruleData, revenue_buckets: next });
                          }}
                          data-testid={`bucket-required-${i}`}
                        />
                        <span className="text-[10px] text-muted-foreground">Wajib</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="col-span-1 h-8 w-8"
                        onClick={() => setRuleData({ ...ruleData, revenue_buckets: buckets.filter((_, j) => j !== i) })}
                        data-testid={`bucket-remove-${i}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Aturan Validasi
                </h5>
                <Button variant="ghost" size="sm" onClick={addValidation} data-testid="sales-add-validation-btn">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                </Button>
              </div>
              {validations.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada aturan validasi.</p>
              ) : (
                <div className="space-y-2">
                  {validations.map((v, i) => (
                    <div key={v.id || i} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-7 h-8"
                        value={v.label}
                        onChange={(e) => {
                          const next = [...validations];
                          next[i] = { ...v, label: e.target.value };
                          setRuleData({ ...ruleData, validation_rules: next });
                        }}
                        placeholder="Pesan validasi…"
                        data-testid={`validation-label-${i}`}
                      />
                      <div className="col-span-3">
                        <Select
                          value={v.severity || "warning"}
                          onValueChange={(val) => {
                            const next = [...validations];
                            next[i] = { ...v, severity: val };
                            setRuleData({ ...ruleData, validation_rules: next });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid={`validation-severity-${i}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEVERITIES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1">
                        <Switch
                          checked={v.active !== false}
                          onCheckedChange={(val) => {
                            const next = [...validations];
                            next[i] = { ...v, active: val };
                            setRuleData({ ...ruleData, validation_rules: next });
                          }}
                          data-testid={`validation-active-${i}`}
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="col-span-1 h-8 w-8"
                        onClick={() => setRuleData({ ...ruleData, validation_rules: validations.filter((_, j) => j !== i) })}
                        data-testid={`validation-remove-${i}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }}
      renderPreview={({ ruleData }) => {
        const channels = (ruleData.channels || []).filter((c) => c.active !== false);
        const pms = (ruleData.payment_methods || []).filter((p) => p.active !== false);
        const buckets = ruleData.revenue_buckets || [];
        return (
          <div className="text-xs space-y-2">
            <p>
              Daily Sales akan menampilkan <strong>{channels.length}</strong> channel,{" "}
              <strong>{pms.length}</strong> metode bayar, dan <strong>{buckets.length}</strong> bucket pendapatan.
            </p>
            <p className="text-muted-foreground">
              {channels.slice(0, 4).map((c) => c.name).join(", ")}
              {channels.length > 4 ? `, +${channels.length - 4} lainnya` : ""}
            </p>
          </div>
        );
      }}
    />
  );
}
