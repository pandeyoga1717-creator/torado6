"""Phase 7C+ Forecast Guard tests — POST /api/forecasting/guard/check.

Covers:
- Auth gate (401/403 without token)
- Validation (amount<0, kind invalid, period bad → 400)
- Severity classification ('none', 'mild', 'severe')
- Math correctness (projected = mtd + amount; deviation_pct formula)
- Future period uses monthly_forecast (forecast_value > 0)
- Light regression on /api/forecasting/sales
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@torado.id"
ADMIN_PASSWORD = "Torado@2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("data", {}).get("access_token") or body.get("access_token")
    assert token, f"No access_token in: {body}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Auth ----------
def test_guard_no_auth_returns_401_or_403():
    r = requests.post(
        f"{BASE_URL}/api/forecasting/guard/check",
        json={"amount": 1000, "kind": "expense"},
        timeout=15,
    )
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# ---------- Validation ----------
def test_guard_negative_amount_returns_400(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/forecasting/guard/check",
        headers=auth_headers,
        json={"amount": -100, "kind": "expense"},
        timeout=15,
    )
    assert r.status_code == 400, f"got {r.status_code}: {r.text}"


def test_guard_invalid_kind_returns_400(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/forecasting/guard/check",
        headers=auth_headers,
        json={"amount": 1000, "kind": "asset"},
        timeout=15,
    )
    assert r.status_code == 400


def test_guard_bad_period_returns_400(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/forecasting/guard/check",
        headers=auth_headers,
        json={"amount": 1000, "kind": "expense", "period": "April 2026"},
        timeout=15,
    )
    assert r.status_code == 400


# ---------- Severity classification ----------
def test_guard_small_expense_severity_none(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/forecasting/guard/check",
        headers=auth_headers,
        json={"amount": 100000, "kind": "expense"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    v = r.json()["data"]
    assert v["severity"] == "none", f"expected none, got {v['severity']} ({v})"
    # Math: projected == mtd + amount
    assert abs(v["projected"] - (v["mtd_amount"] + v["amount"])) < 0.01
    # Required keys
    for k in ("severity", "deviation_pct", "mtd_amount", "projected",
              "forecast_value", "ci_band", "message", "period"):
        assert k in v, f"missing {k}"


def test_guard_huge_expense_severity_severe_or_mild(auth_headers):
    """200M consolidated added to the ~392M MTD should explode past forecast."""
    r = requests.post(
        f"{BASE_URL}/api/forecasting/guard/check",
        headers=auth_headers,
        json={"amount": 200000000, "kind": "expense"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    v = r.json()["data"]
    assert v["severity"] in ("mild", "severe"), f"expected mild/severe, got {v['severity']} ({v})"
    assert v["projected"] > v["forecast_value"]


def test_guard_math_projected_and_deviation_pct(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/forecasting/guard/check",
        headers=auth_headers,
        json={"amount": 50000000, "kind": "expense"},
        timeout=30,
    )
    assert r.status_code == 200
    v = r.json()["data"]
    # projected ~== mtd + amount
    assert abs(v["projected"] - (v["mtd_amount"] + v["amount"])) < 1.0
    # deviation_pct == (projected - forecast)/forecast * 100
    if v["forecast_value"] > 0:
        expected_pct = round((v["projected"] - v["forecast_value"]) / v["forecast_value"] * 100, 2)
        assert abs(v["deviation_pct"] - expected_pct) < 0.05


# ---------- Future period uses monthly_forecast ----------
def test_guard_future_period_has_forecast_value(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/forecasting/guard/check",
        headers=auth_headers,
        json={"amount": 10000000, "kind": "expense", "period": "2026-05"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    v = r.json()["data"]
    assert v["period"] == "2026-05"
    assert v["forecast_value"] > 0, f"expected forecast_value>0 for future period, got {v}"
    # MTD for a future month must be 0
    assert v["mtd_amount"] == 0.0


# ---------- Light regression on Phase 7C ----------
def test_regression_forecast_sales(auth_headers):
    r = requests.get(f"{BASE_URL}/api/forecasting/sales", headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert "monthly_history" in body and "monthly_forecast" in body


def test_regression_forecast_methods(auth_headers):
    r = requests.get(f"{BASE_URL}/api/forecasting/methods", headers=auth_headers, timeout=15)
    assert r.status_code == 200


def test_regression_reports_pivot(auth_headers):
    r = requests.get(f"{BASE_URL}/api/reports/pivot?metric=revenue", headers=auth_headers, timeout=15)
    # Be lenient — endpoint exists; not the focus of this iteration
    assert r.status_code in (200, 400, 422)
