"""Phase 7B - Advanced Reports backend tests + light regression for prior phases."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://torado-dev-sync.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@torado.id"
ADMIN_PASSWORD = "Torado@2026"

DATE_FROM = "2026-02-01"
DATE_TO = "2026-04-30"


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
    def test_catalog_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/reports/catalog", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_vendor_scorecard_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/reports/vendor-scorecard", timeout=15)
        assert r.status_code in (401, 403)


# ---------------------- CATALOG ----------------------
class TestCatalog:
    def test_catalog_returns_dims_metrics_comparatives(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/catalog", timeout=15)
        assert r.status_code == 200
        data = r.json()["data"]
        dim_keys = {d["key"] for d in data["dimensions"]}
        metric_keys = {m["key"] for m in data["metrics"]}
        comp_keys = {c["key"] for c in data["comparatives"]}
        assert {"outlet", "brand", "vendor", "category", "month"}.issubset(dim_keys)
        assert {"sales", "transaction_count", "cogs", "gross_profit",
                "ap_exposure", "po_count", "gr_count", "purchase_value"}.issubset(metric_keys)
        assert {"mom", "yoy"}.issubset(comp_keys)


# ---------------------- VENDOR SCORECARD ----------------------
class TestVendorScorecard:
    def test_scorecard_list_top5(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/vendor-scorecard",
                     params={"top": 5, "date_from": DATE_FROM, "date_to": DATE_TO},
                     timeout=30)
        assert r.status_code == 200
        d = r.json()["data"]
        assert "vendors" in d
        assert len(d["vendors"]) <= 5
        if d["vendors"]:
            v = d["vendors"][0]
            for key in ("composite_score", "on_time_pct", "avg_lead_time_days",
                        "defect_rate_pct", "price_stability_pct", "total_spend",
                        "vendor_id", "vendor_name"):
                assert key in v, f"missing key {key} in scorecard row"
            # Sorted desc by total_spend
            spends = [r_["total_spend"] for r_ in d["vendors"]]
            assert spends == sorted(spends, reverse=True)
            # Composite score arithmetic check (when all components present)
            if (v["on_time_pct"] is not None and v["price_stability_pct"] is not None
                    and v["defect_rate_pct"] is not None and v["avg_lead_time_days"] is not None):
                lead_score = max(0, 100 - (v["avg_lead_time_days"] / 14) * 100)
                expected = round(
                    v["on_time_pct"] * 0.40
                    + v["price_stability_pct"] * 0.25
                    + max(0, 100 - v["defect_rate_pct"]) * 0.20
                    + lead_score * 0.15, 2,
                )
                assert abs(v["composite_score"] - expected) < 0.05, \
                    f"composite_score arithmetic mismatch {v['composite_score']} vs {expected}"

    def test_scorecard_detail_includes_po_breakdown(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/vendor-scorecard",
                     params={"top": 1, "date_from": DATE_FROM, "date_to": DATE_TO},
                     timeout=30)
        assert r.status_code == 200
        vendors = r.json()["data"]["vendors"]
        if not vendors:
            pytest.skip("no vendor data seeded")
        vid = vendors[0]["vendor_id"]
        r2 = auth.get(f"{BASE_URL}/api/reports/vendor-scorecard/{vid}",
                      params={"date_from": DATE_FROM, "date_to": DATE_TO}, timeout=30)
        assert r2.status_code == 200
        d = r2.json()["data"]
        assert d["vendors"], "expected detail row"
        row = d["vendors"][0]
        assert row["vendor_id"] == vid
        assert "po_breakdown" in row
        if row["po_breakdown"]:
            po = row["po_breakdown"][0]
            for k in ("po_id", "doc_no", "order_date", "on_time", "grand_total"):
                assert k in po


# ---------------------- REPORT BUILDER ----------------------
class TestReportBuilder:
    def test_run_basic(self, auth):
        r = auth.post(f"{BASE_URL}/api/reports/builder/run", json={
            "dimensions": ["outlet"],
            "metrics": ["sales", "gross_profit"],
            "period_from": DATE_FROM, "period_to": DATE_TO,
        }, timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        assert "rows" in d and "totals" in d and "row_count" in d
        assert d["row_count"] == len(d["rows"])
        for row in d["rows"]:
            assert "dim_outlet" in row
            assert "sales" in row and "gross_profit" in row
        # totals match sum
        if d["rows"]:
            sum_sales = round(sum(r_["sales"] for r_ in d["rows"]), 2)
            assert abs(sum_sales - d["totals"]["sales"]) < 1.0

    def test_validation_empty_dimensions(self, auth):
        r = auth.post(f"{BASE_URL}/api/reports/builder/run", json={
            "dimensions": [], "metrics": ["sales"]}, timeout=15)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"

    def test_validation_empty_metrics(self, auth):
        r = auth.post(f"{BASE_URL}/api/reports/builder/run", json={
            "dimensions": ["outlet"], "metrics": []}, timeout=15)
        assert r.status_code == 400

    def test_validation_invalid_dimension(self, auth):
        r = auth.post(f"{BASE_URL}/api/reports/builder/run", json={
            "dimensions": ["not_a_dim"], "metrics": ["sales"]}, timeout=15)
        assert r.status_code == 400

    def test_validation_invalid_metric(self, auth):
        r = auth.post(f"{BASE_URL}/api/reports/builder/run", json={
            "dimensions": ["outlet"], "metrics": ["not_a_metric"]}, timeout=15)
        assert r.status_code == 400


# ---------------------- PIVOT ----------------------
class TestPivot:
    def test_pivot_month_x_outlet_sales(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/pivot", params={
            "dim_x": "month", "dim_y": "outlet", "metric": "sales",
            "period_from": DATE_FROM, "period_to": DATE_TO}, timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        for k in ("x_labels", "y_labels", "cells", "row_totals", "col_totals", "grand_total"):
            assert k in d
        assert len(d["cells"]) == len(d["y_labels"])
        for row in d["cells"]:
            assert len(row) == len(d["x_labels"])
        assert len(d["row_totals"]) == len(d["y_labels"])
        assert len(d["col_totals"]) == len(d["x_labels"])

    def test_pivot_same_dim_returns_400(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/pivot", params={
            "dim_x": "outlet", "dim_y": "outlet", "metric": "sales"}, timeout=15)
        assert r.status_code == 400


# ---------------------- COMPARATIVES ----------------------
class TestComparatives:
    def test_mom(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/comparatives", params={
            "metric": "sales", "period": "2026-04", "compare_to": "mom"}, timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        for k in ("current", "previous", "delta", "delta_pct", "rolling_12m", "previous_period"):
            assert k in d
        assert d["previous_period"] == "2026-03"
        assert len(d["rolling_12m"]) == 12

    def test_yoy(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/comparatives", params={
            "metric": "sales", "period": "2026-04", "compare_to": "yoy"}, timeout=60)
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["previous_period"] == "2025-04"


# ---------------------- SAVED REPORTS CRUD ----------------------
class TestSavedReports:
    def test_create_list_delete(self, auth):
        payload = {
            "name": "TEST_phase7b_saved",
            "description": "test",
            "config": {"dimensions": ["outlet"], "metrics": ["sales"]},
        }
        r = auth.post(f"{BASE_URL}/api/reports/saved", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        sid = r.json()["data"]["id"]

        r2 = auth.get(f"{BASE_URL}/api/reports/saved", timeout=15)
        assert r2.status_code == 200
        ids = [s["id"] for s in r2.json()["data"]]
        assert sid in ids

        r3 = auth.delete(f"{BASE_URL}/api/reports/saved/{sid}", timeout=15)
        assert r3.status_code == 200
        assert r3.json()["data"]["deleted"] is True

        # Confirm not in list anymore
        r4 = auth.get(f"{BASE_URL}/api/reports/saved", timeout=15)
        assert sid not in [s["id"] for s in r4.json()["data"]]


# ---------------------- REGRESSION ----------------------
class TestRegression:
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

    def test_finance_journals(self, auth):
        r = auth.get(f"{BASE_URL}/api/finance/journals", timeout=30)
        assert r.status_code == 200

    def test_approvals_queue(self, auth):
        r = auth.get(f"{BASE_URL}/api/approvals/queue", timeout=15)
        assert r.status_code == 200

    def test_finance_periods(self, auth):
        r = auth.get(f"{BASE_URL}/api/finance/periods", timeout=15)
        assert r.status_code == 200

    def test_hr_advances(self, auth):
        r = auth.get(f"{BASE_URL}/api/hr/advances", timeout=15)
        assert r.status_code == 200

    def test_hr_payroll(self, auth):
        r = auth.get(f"{BASE_URL}/api/hr/payroll", timeout=15)
        assert r.status_code == 200
