import RuleListPage from "./RuleListPage";
import SalesSchemaEditor from "./SalesSchemaEditor";

const DEFAULT_DATA = {
  channels: [],
  payment_methods: [],
  revenue_buckets: [],
  validation_rules: [],
};

export default function SalesSchemasPage() {
  return (
    <RuleListPage
      ruleType="sales_input_schema"
      title="Skema Penjualan"
      description="Kelola channel, metode pembayaran, bucket pendapatan, dan aturan validasi yang dipakai form Daily Sales."
      emptyTitle="Belum ada skema penjualan"
      emptyDescription="Buat skema untuk mengatur channel, metode bayar, dan bucket pendapatan per outlet."
      EditorComponent={SalesSchemaEditor}
      defaultRuleData={DEFAULT_DATA}
      testIdPrefix="sales-schemas"
    />
  );
}
