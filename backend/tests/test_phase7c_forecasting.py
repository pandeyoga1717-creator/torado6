"""Phase 7C - 3-month sales/expense forecasting backend tests + light regression."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://torado-dev-sync.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@torado.id"
ADMIN_PASSWORD = "Torado@2026"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["data"]["access_token"]


@pytest.fixture(scope="session")
def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ---------------------- AUTH GUARD ----------------------
class TestAuthGuard:
    def test_sales_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/forecasting/sales", timeout=15)
        assert r.status_code in (401, 403)

    def test_methods_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/forecasting/methods", timeout=15)
        assert r.status_code in (401, 403)


# ---------------------- METHODS CATALOG ----------------------
class TestMethods:
    def test_methods_returns_3_methods_2_targets(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/methods", timeout=15)
        assert r.status_code == 200
        data = r.json()["data"]
        method_keys = {m["key"] for m in data["methods"]}
        target_keys = {t["key"] for t in data["targets"]}
        assert method_keys == {"linear", "ewma", "hybrid"}
        assert target_keys == {"sales", "expense"}


# ---------------------- SALES FORECAST ----------------------
class TestSalesForecast:
    def test_sales_default_full_payload(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/sales", timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        # All required keys per spec
        for k in ("history_daily", "forecast_daily", "monthly_history",
                  "monthly_forecast", "confidence_band", "accuracy_mape",
                  "totals", "comparison_methods", "params", "method"):
            assert k in d, f"missing key {k}"
        assert d["method"] == "hybrid"
        assert isinstance(d["history_daily"], list)
        assert isinstance(d["forecast_daily"], list)
        assert len(d["history_daily"]) > 0
        assert len(d["forecast_daily"]) > 0
        for tk in ("history_total", "history_avg_daily", "forecast_total",
                   "forecast_avg_daily", "growth_pct"):
            assert tk in d["totals"]
        for mk in ("linear", "ewma", "hybrid"):
            assert mk in d["comparison_methods"]

    def test_sales_method_linear_params(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/sales", params={"method": "linear"}, timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["method"] == "linear"
        for p in ("a", "b", "r2"):
            assert p in d["params"]

    def test_sales_method_ewma_params(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/sales", params={"method": "ewma"}, timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["method"] == "ewma"
        for p in ("alpha", "level"):
            assert p in d["params"]

    def test_sales_method_hybrid_params(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/sales", params={"method": "hybrid"}, timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["method"] == "hybrid"
        for p in ("alpha", "weight", "linear_a", "linear_b", "ewma_level", "r2"):
            assert p in d["params"]

    def test_sales_per_outlet_smaller_than_consolidated(self, auth):
        # get an outlet id
        r_consol = auth.get(f"{BASE_URL}/api/forecasting/sales", timeout=60)
        consol_total = r_consol.json()["data"]["totals"]["history_total"]

        # use dashboard to discover outlets
        r_dash = auth.get(f"{BASE_URL}/api/forecasting/dashboard", timeout=90)
        outlets = r_dash.json()["data"]["outlets"]
        if not outlets:
            pytest.skip("no outlets")
        oid = outlets[0]["outlet_id"]
        r_o = auth.get(f"{BASE_URL}/api/forecasting/sales",
                       params={"outlet_id": oid}, timeout=60)
        assert r_o.status_code == 200
        outlet_total = r_o.json()["data"]["totals"]["history_total"]
        assert outlet_total <= consol_total + 1, \
            f"outlet history {outlet_total} should be <= consolidated {consol_total}"

    def test_sales_months_6(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/sales", params={"months": 6}, timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        assert len(d["monthly_forecast"]) == 6

    def test_sales_invalid_method_returns_400(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/sales",
                     params={"method": "bogus"}, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"

    def test_sales_months_out_of_range_returns_422(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/sales",
                     params={"months": 24}, timeout=15)
        assert r.status_code == 422

    def test_math_forecast_total_matches_sum(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/sales",
                     params={"method": "hybrid"}, timeout=60)
        d = r.json()["data"]
        sum_daily = round(sum(p["value"] for p in d["forecast_daily"]), 2)
        # totals.forecast_total should be close (rounding tolerated)
        assert abs(sum_daily - d["totals"]["forecast_total"]) < 1.0, \
            f"forecast_daily sum {sum_daily} != totals.forecast_total {d['totals']['forecast_total']}"


# ---------------------- EXPENSE FORECAST ----------------------
class TestExpenseForecast:
    def test_expense_returns_data(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/expense", timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["target"] == "expense"
        # COGS journals seeded -> should have non-zero history
        assert d["totals"]["history_total"] > 0, \
            "expense history_total should be > 0 with COGS journals seeded"


# ---------------------- DASHBOARD ----------------------
class TestDashboard:
    def test_dashboard_returns_consolidated_and_outlets(self, auth):
        r = auth.get(f"{BASE_URL}/api/forecasting/dashboard", timeout=120)
        assert r.status_code == 200
        d = r.json()["data"]
        assert "consolidated" in d
        assert "outlets" in d
        assert len(d["outlets"]) == 4, f"expected 4 outlets, got {len(d['outlets'])}"
        for row in d["outlets"]:
            for k in ("outlet_id", "outlet_name", "history_total",
                      "forecast_total", "growth_pct", "accuracy_mape"):
                assert k in row, f"missing {k} in outlet row"


# ---------------------- REGRESSION (Phase 7B + earlier) ----------------------
class TestRegression:
    def test_reports_vendor_scorecard(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/vendor-scorecard",
                     params={"top": 5}, timeout=30)
        assert r.status_code == 200

    def test_reports_pivot(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/pivot", params={
            "dim_x": "month", "dim_y": "outlet", "metric": "sales"}, timeout=60)
        assert r.status_code == 200

    def test_reports_comparatives(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/comparatives", params={
            "metric": "sales", "period": "2026-04", "compare_to": "mom"}, timeout=30)
        assert r.status_code == 200

    def test_reports_builder_run(self, auth):
        r = auth.post(f"{BASE_URL}/api/reports/builder/run", json={
            "dimensions": ["outlet"], "metrics": ["sales"]}, timeout=60)
        assert r.status_code == 200

    def test_finance_profit_loss(self, auth):
        r = auth.get(f"{BASE_URL}/api/finance/profit-loss",
                     params={"period": "2026-04"}, timeout=30)
        assert r.status_code == 200

    def test_finance_trial_balance(self, auth):
        r = auth.get(f"{BASE_URL}/api/finance/trial-balance",
                     params={"period": "2026-04"}, timeout=30)
        assert r.status_code == 200

    def test_finance_ap_aging(self, auth):
        r = auth.get(f"{BASE_URL}/api/finance/ap-aging", timeout=30)
        assert r.status_code == 200
