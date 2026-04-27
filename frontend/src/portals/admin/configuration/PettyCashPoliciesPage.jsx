import RuleListPage from "./RuleListPage";
import PettyCashPolicyEditor from "./PettyCashPolicyEditor";

const DEFAULT_DATA = {
  monthly_limit: 5_000_000,
  max_per_txn: 500_000,
  approval_threshold: 250_000,
  replenish_frequency: "weekly",
  require_receipt: true,
};

export default function PettyCashPoliciesPage() {
  return (
    <RuleListPage
      ruleType="petty_cash_policy"
      title="Kebijakan Kas Kecil"
      description="Limit, threshold approval, frekuensi replenish, dan kewajiban lampiran struk."
      emptyTitle="Belum ada kebijakan kas kecil"
      emptyDescription="Atur limit dan threshold approval agar transaksi kas kecil konsisten."
      EditorComponent={PettyCashPolicyEditor}
      defaultRuleData={DEFAULT_DATA}
      testIdPrefix="petty-cash"
    />
  );
}
