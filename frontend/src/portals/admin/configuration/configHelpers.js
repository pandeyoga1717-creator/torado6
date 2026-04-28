/** Helpers shared by /admin/configuration/* pages. */
import { fmtDate } from "@/lib/format";

export const RULE_LABELS = {
  sales_input_schema: "Skema Penjualan",
  petty_cash_policy: "Kebijakan Kas Kecil",
  service_charge_policy: "Service Charge",
  incentive_policy: "Skema Insentif",
  anomaly_threshold_policy: "Threshold Deteksi Anomali",
};

export function ruleStatus(rule) {
  if (!rule) return "disabled";
  if (!rule.active) return "disabled";
  const today = new Date().toISOString().slice(0, 10);
  if (rule.effective_from && rule.effective_from > today) return "draft";
  if (rule.effective_to && rule.effective_to < today) return "closed";
  return "active";
}

export function effectiveText(rule) {
  const a = rule?.effective_from ? fmtDate(rule.effective_from) : "sejak awal";
  const b = rule?.effective_to ? fmtDate(rule.effective_to) : "tanpa batas";
  return `${a} → ${b}`;
}
