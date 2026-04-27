import RuleListPage from "./RuleListPage";
import IncentiveSchemeEditor from "./IncentiveSchemeEditor";

const DEFAULT_DATA = {
  rule_type: "pct_of_sales",
  target_amount: 100_000_000,
  incentive_pct: 0.01,
  flat_amount: 0,
  tiers: [],
  eligibility: {
    roles: [],
    min_days_worked: 22,
    exclude_probation: true,
  },
};

export default function IncentiveSchemesPage() {
  return (
    <RuleListPage
      ruleType="incentive_policy"
      title="Skema Insentif"
      description="Bangun aturan insentif (% penjualan / flat / tier) dengan eligibility."
      emptyTitle="Belum ada skema insentif"
      emptyDescription="Buat skema untuk target penjualan dan perhitungan insentif."
      EditorComponent={IncentiveSchemeEditor}
      defaultRuleData={DEFAULT_DATA}
      testIdPrefix="incentive"
    />
  );
}
