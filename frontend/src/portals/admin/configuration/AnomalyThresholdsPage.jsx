import RuleListPage from "./RuleListPage";
import AnomalyThresholdEditor from "./AnomalyThresholdEditor";

const DEFAULT_DATA = {
  sales_deviation: {
    enabled: true, sigma_mild: 1.5, sigma_severe: 2.5,
    window_days: 14, min_points: 7,
  },
  vendor_price_spike: {
    enabled: true, pct_mild: 15, pct_severe: 30, window_days: 90,
  },
  vendor_leadtime: {
    enabled: true, days_mild: 3, days_severe: 7, window_days: 90,
  },
  ap_cash_spike: {
    enabled: true, pct_mild: 15, pct_severe: 30,
  },
};

export default function AnomalyThresholdsPage() {
  return (
    <RuleListPage
      ruleType="anomaly_threshold_policy"
      title="Threshold Deteksi Anomali"
      description="Atur threshold per-tipe anomali (sales / vendor / kas) per scope dengan versi dan periode berlaku."
      emptyTitle="Belum ada threshold policy"
      emptyDescription="Gunakan default group atau buat kebijakan khusus outlet/brand."
      EditorComponent={AnomalyThresholdEditor}
      defaultRuleData={DEFAULT_DATA}
      testIdPrefix="anomaly-threshold"
    />
  );
}
