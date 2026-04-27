import RuleListPage from "./RuleListPage";
import ServiceChargePolicyEditor from "./ServiceChargePolicyEditor";

const DEFAULT_DATA = {
  service_charge_pct: 0.05,
  lb_pct: 0.01,
  ld_pct: 0,
  allocation_method: "by_days_worked",
  default_working_days: 22,
};

export default function ServiceChargePoliciesPage() {
  return (
    <RuleListPage
      ruleType="service_charge_policy"
      title="Service Charge"
      description="Formula % dengan potongan L&B/L&D dan metode alokasi ke karyawan."
      emptyTitle="Belum ada aturan service charge"
      emptyDescription="Tentukan % service charge dan metode alokasi untuk payroll."
      EditorComponent={ServiceChargePolicyEditor}
      defaultRuleData={DEFAULT_DATA}
      testIdPrefix="service-charge"
    />
  );
}
