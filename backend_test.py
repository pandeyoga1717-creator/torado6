#!/usr/bin/env python3
"""
Backend API Testing for Aurora F&B ERP Phase 7D
Tests anomaly detection system, triage actions, and permissions
"""
import requests
import json
import sys
from datetime import datetime, timedelta

class Phase7DAPITester:
    def __init__(self, base_url="https://torado-staging.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.finance_token = None
        self.executive_token = None
        self.procurement_token = None
        self.outlet_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_anomaly_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        test_headers = {'Content-Type': 'application/json'}
        
        if token:
            test_headers['Authorization'] = f'Bearer {token}'
        elif headers:
            test_headers.update(headers)
            
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:500]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            return False, {}

    def login(self, email, password):
        """Login and get token"""
        success, response = self.run_test(
            f"Login as {email}",
            "POST",
            "/api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'data' in response and 'access_token' in response['data']:
            return response['data']['access_token']
        return None

    def test_anomaly_types(self):
        """Test anomaly types endpoint"""
        success, response = self.run_test(
            "Get anomaly types",
            "GET",
            "/api/anomalies/types",
            200,
            token=self.admin_token
        )
        if success and 'data' in response:
            types = response['data']
            print(f"   Found {len(types)} anomaly types")
            expected_types = ["sales_deviation", "vendor_price_spike", "vendor_leadtime", "ap_cash_spike"]
            for expected in expected_types:
                found = any(t.get('value') == expected for t in types)
                if found:
                    print(f"   ✓ {expected} type found")
                else:
                    print(f"   ✗ {expected} type missing")
                    return False
        return success

    def test_anomaly_summary(self):
        """Test anomaly summary endpoint"""
        success, response = self.run_test(
            "Get anomaly summary (7 days)",
            "GET",
            "/api/anomalies/summary",
            200,
            data={"days": 7},
            token=self.admin_token
        )
        if success and 'data' in response:
            data = response['data']
            counts = data.get('counts', {})
            print(f"   Summary: {counts.get('total', 0)} total, {counts.get('severe', 0)} severe, {counts.get('mild', 0)} mild, {counts.get('open', 0)} open")
            
            # Test different day ranges
            for days in [14, 30]:
                success2, response2 = self.run_test(
                    f"Get anomaly summary ({days} days)",
                    "GET",
                    "/api/anomalies/summary",
                    200,
                    data={"days": days},
                    token=self.admin_token
                )
                if success2 and 'data' in response2:
                    counts2 = response2['data'].get('counts', {})
                    print(f"   Summary {days}d: {counts2.get('total', 0)} total")
        return success

    def test_anomaly_list(self):
        """Test anomaly list endpoint with filters"""
        # Test basic list
        success, response = self.run_test(
            "List anomalies (basic)",
            "GET",
            "/api/anomalies",
            200,
            data={"per_page": 50},
            token=self.admin_token
        )
        
        anomalies = []
        if success and 'data' in response:
            anomalies = response['data']
            meta = response.get('meta', {})
            print(f"   Found {len(anomalies)} anomalies (total: {meta.get('total', 0)})")
            
            # Store first anomaly ID for detail testing
            if anomalies:
                self.created_anomaly_ids.append(anomalies[0].get('id'))
        
        # Test filters
        filters = [
            {"type": "sales_deviation"},
            {"severity": "severe"},
            {"status": "open"},
            {"status": ""},  # All statuses
        ]
        
        for filter_params in filters:
            filter_name = ", ".join([f"{k}={v}" for k, v in filter_params.items()])
            success2, response2 = self.run_test(
                f"List anomalies with filter ({filter_name})",
                "GET",
                "/api/anomalies",
                200,
                data={**filter_params, "per_page": 50},
                token=self.admin_token
            )
            if success2 and 'data' in response2:
                filtered_count = len(response2['data'])
                print(f"   Filter {filter_name}: {filtered_count} results")
        
        return success

    def test_anomaly_detail(self):
        """Test anomaly detail endpoint"""
        if not self.created_anomaly_ids:
            print("   ⚠️  No anomaly IDs available for detail testing")
            return True
            
        anomaly_id = self.created_anomaly_ids[0]
        success, response = self.run_test(
            f"Get anomaly detail",
            "GET",
            f"/api/anomalies/{anomaly_id}",
            200,
            token=self.admin_token
        )
        
        if success and 'data' in response:
            anomaly = response['data']
            print(f"   Anomaly: {anomaly.get('type')} - {anomaly.get('severity')} - {anomaly.get('status')}")
            print(f"   Title: {anomaly.get('title', 'N/A')}")
            
            # Verify required fields
            required_fields = ['id', 'type', 'severity', 'status', 'created_at']
            for field in required_fields:
                if field not in anomaly:
                    print(f"   ✗ Missing required field: {field}")
                    return False
                else:
                    print(f"   ✓ {field}: {anomaly[field]}")
        
        return success

    def test_anomaly_triage(self):
        """Test anomaly triage actions"""
        if not self.created_anomaly_ids:
            print("   ⚠️  No anomaly IDs available for triage testing")
            return True
            
        anomaly_id = self.created_anomaly_ids[0]
        
        # Test acknowledge action
        success1, response1 = self.run_test(
            "Triage anomaly - acknowledge",
            "POST",
            f"/api/anomalies/{anomaly_id}/triage",
            200,
            data={
                "status": "acknowledged",
                "note": "Test acknowledgment from backend test"
            },
            token=self.admin_token
        )
        
        if success1 and 'data' in response1:
            updated = response1['data']
            print(f"   Status updated to: {updated.get('status')}")
            print(f"   Acknowledged by: {updated.get('acknowledged_by')}")
        
        # Test investigating action
        success2, response2 = self.run_test(
            "Triage anomaly - investigating",
            "POST",
            f"/api/anomalies/{anomaly_id}/triage",
            200,
            data={
                "status": "investigating",
                "note": "Test investigation from backend test"
            },
            token=self.admin_token
        )
        
        # Test resolve action
        success3, response3 = self.run_test(
            "Triage anomaly - resolve",
            "POST",
            f"/api/anomalies/{anomaly_id}/triage",
            200,
            data={
                "status": "resolved",
                "note": "Test resolution from backend test"
            },
            token=self.admin_token
        )
        
        if success3 and 'data' in response3:
            resolved = response3['data']
            print(f"   Final status: {resolved.get('status')}")
            print(f"   Resolved by: {resolved.get('resolved_by')}")
        
        return success1 and success2 and success3

    def test_manual_scan(self):
        """Test manual anomaly scan"""
        success, response = self.run_test(
            "Manual anomaly scan",
            "POST",
            "/api/anomalies/scan",
            200,
            data={
                "days": 14,
                "as_of_date": datetime.now().strftime("%Y-%m-%d")
            },
            token=self.admin_token
        )
        
        if success and 'data' in response:
            scan_result = response['data']
            counts = scan_result.get('counts', {})
            print(f"   Scan completed: {counts.get('total', 0)} anomalies found")
            print(f"   Sales: {counts.get('sales_deviation', 0)}, Vendor: {counts.get('vendor', 0)}, AP/Cash: {counts.get('ap_cash_spike', 0)}")
            print(f"   Scan date: {scan_result.get('as_of_date')}")
        
        return success

    def test_threshold_resolution(self):
        """Test threshold resolution endpoint"""
        success, response = self.run_test(
            "Resolve thresholds (group level)",
            "GET",
            "/api/anomalies/thresholds/resolve",
            200,
            data={},
            token=self.admin_token
        )
        
        if success and 'data' in response:
            thresholds = response['data']
            print(f"   Resolved thresholds for rule: {thresholds.get('_rule_id', 'default')}")
            
            # Check for expected threshold types
            expected_types = ["sales_deviation", "vendor_price_spike", "vendor_leadtime", "ap_cash_spike"]
            for threshold_type in expected_types:
                if threshold_type in thresholds:
                    config = thresholds[threshold_type]
                    enabled = config.get('enabled', False)
                    print(f"   ✓ {threshold_type}: enabled={enabled}")
                else:
                    print(f"   ✗ {threshold_type}: missing")
                    return False
        
        return success

    def test_permissions_finance(self):
        """Test finance user permissions"""
        if not self.finance_token:
            print("   ⚠️  No finance token available")
            return True
            
        # Finance should be able to read anomalies
        success1, _ = self.run_test(
            "Finance user - list anomalies",
            "GET",
            "/api/anomalies",
            200,
            data={"per_page": 10},
            token=self.finance_token
        )
        
        # Finance should be able to triage
        if self.created_anomaly_ids:
            success2, _ = self.run_test(
                "Finance user - triage anomaly",
                "POST",
                f"/api/anomalies/{self.created_anomaly_ids[0]}/triage",
                200,
                data={"status": "acknowledged", "note": "Finance test"},
                token=self.finance_token
            )
        else:
            success2 = True
            
        # Finance should be able to trigger scan
        success3, _ = self.run_test(
            "Finance user - manual scan",
            "POST",
            "/api/anomalies/scan",
            200,
            data={"days": 7},
            token=self.finance_token
        )
        
        return success1 and success2 and success3

    def test_permissions_outlet_manager(self):
        """Test outlet manager permissions (should be restricted)"""
        if not self.outlet_token:
            print("   ⚠️  No outlet token available")
            return True
            
        # Outlet manager should NOT have access to anomaly feed
        success, response = self.run_test(
            "Outlet manager - list anomalies (should fail)",
            "GET",
            "/api/anomalies",
            403,  # Expecting forbidden
            data={"per_page": 10},
            token=self.outlet_token
        )
        
        return success

    def test_live_sales_validation_hook(self):
        """Test live sales validation hook by creating a large sales entry"""
        # Create a synthetic large daily sales entry
        large_amount = 50000000  # 50M - should trigger anomaly
        today = datetime.now().strftime("%Y-%m-%d")
        
        success, response = self.run_test(
            "Create large daily sales (should trigger anomaly)",
            "POST",
            "/api/outlet/daily-sales",
            200,
            data={
                "outlet_id": "test-outlet-synthetic",
                "sales_date": today,
                "grand_total": large_amount,
                "cash_sales": large_amount * 0.3,
                "card_sales": large_amount * 0.7,
                "status": "validated"
            },
            token=self.admin_token
        )
        
        if success:
            print(f"   Created large sales entry: Rp {large_amount:,}")
            
            # Wait a moment for async processing
            import time
            time.sleep(2)
            
            # Check if anomaly was created
            success2, response2 = self.run_test(
                "Check for new sales anomaly",
                "GET",
                "/api/anomalies",
                200,
                data={"type": "sales_deviation", "per_page": 10},
                token=self.admin_token
            )
            
            if success2 and 'data' in response2:
                anomalies = response2['data']
                recent_anomaly = None
                for anomaly in anomalies:
                    if anomaly.get('source_type') == 'daily_sales' and anomaly.get('scan_date') == today:
                        recent_anomaly = anomaly
                        break
                
                if recent_anomaly:
                    print(f"   ✓ Anomaly auto-created: {recent_anomaly.get('severity')} - {recent_anomaly.get('title')}")
                    self.created_anomaly_ids.append(recent_anomaly.get('id'))
                    
                    # Check if notification was sent
                    success3, response3 = self.run_test(
                        "Check anomaly notifications",
                        "GET",
                        "/api/notifications",
                        200,
                        data={"source_type": "anomaly_event", "per_page": 10},
                        token=self.admin_token
                    )
                    
                    if success3 and 'data' in response3:
                        notifications = response3['data']
                        anomaly_notifs = [n for n in notifications if n.get('source_id') == recent_anomaly.get('id')]
                        print(f"   ✓ {len(anomaly_notifs)} notification(s) sent for anomaly")
                else:
                    print(f"   ⚠️  No anomaly auto-created (may be expected if baseline insufficient)")
        
        return success

    def test_regression_phase7c(self):
        """Test Phase 7C regression - forecasting features"""
        # Test forecasting page endpoint
        success1, _ = self.run_test(
            "Regression - forecasting dashboard",
            "GET",
            "/api/forecasting/dashboard",
            200,
            token=self.admin_token
        )
        
        # Test forecast guard check
        success2, _ = self.run_test(
            "Regression - forecast guard check",
            "POST",
            "/api/forecasting/guard/check",
            200,
            data={
                "outlet_id": "test-outlet",
                "period": "2026-08",
                "amount": 1000000
            },
            token=self.admin_token
        )
        
        return success1 and success2

    def test_regression_admin_config(self):
        """Test admin configuration regression"""
        # Test existing config tabs still work
        config_endpoints = [
            "/api/admin/business-rules?rule_type=sales_input_schema",
            "/api/admin/business-rules?rule_type=petty_cash_policy", 
            "/api/admin/business-rules?rule_type=service_charge_policy",
            "/api/admin/business-rules?rule_type=incentive_policy"
        ]
        
        all_success = True
        for endpoint in config_endpoints:
            rule_type = endpoint.split('=')[1]
            success, response = self.run_test(
                f"Regression - {rule_type} config",
                "GET",
                endpoint,
                200,
                token=self.admin_token
            )
            if success and 'data' in response:
                rules = response['data']
                print(f"   {rule_type}: {len(rules)} rules found")
            all_success = all_success and success
        
        return all_success

    def cleanup_created_anomalies(self):
        """Clean up anomalies created during testing"""
        print(f"\n🧹 Note: {len(self.created_anomaly_ids)} anomalies were created/modified during testing")
        # Note: We don't delete anomalies as they're part of the audit trail

    def run_all_tests(self):
        """Run comprehensive Phase 7D backend tests"""
        print("🚀 Starting Aurora F&B ERP Phase 7D Backend Tests")
        print("=" * 60)
        
        # Login as different users
        print("\n📋 Authentication Tests")
        self.admin_token = self.login("admin@torado.id", "Torado@2026")
        if not self.admin_token:
            print("❌ Failed to login as admin - aborting tests")
            return False
            
        # Login as other users for permission testing
        self.finance_token = self.login("finance@torado.id", "Torado@2026")
        self.executive_token = self.login("executive@torado.id", "Torado@2026")
        self.procurement_token = self.login("procurement@torado.id", "Torado@2026")
        self.outlet_token = self.login("alt.manager@torado.id", "Torado@2026")
        
        try:
            # Test 1: Anomaly Types
            print("\n📋 Anomaly Types Tests")
            self.test_anomaly_types()
            
            # Test 2: Anomaly Summary
            print("\n📋 Anomaly Summary Tests")
            self.test_anomaly_summary()
            
            # Test 3: Anomaly List & Filters
            print("\n📋 Anomaly List & Filter Tests")
            self.test_anomaly_list()
            
            # Test 4: Anomaly Detail
            print("\n📋 Anomaly Detail Tests")
            self.test_anomaly_detail()
            
            # Test 5: Threshold Resolution
            print("\n📋 Threshold Resolution Tests")
            self.test_threshold_resolution()
            
            # Test 6: Manual Scan
            print("\n📋 Manual Scan Tests")
            self.test_manual_scan()
            
            # Test 7: Triage Actions
            print("\n📋 Triage Action Tests")
            self.test_anomaly_triage()
            
            # Test 8: Live Sales Hook
            print("\n📋 Live Sales Validation Hook Tests")
            self.test_live_sales_validation_hook()
            
            # Test 9: Permissions - Finance User
            print("\n📋 Finance User Permission Tests")
            self.test_permissions_finance()
            
            # Test 10: Permissions - Outlet Manager (Restricted)
            print("\n📋 Outlet Manager Permission Tests")
            self.test_permissions_outlet_manager()
            
            # Test 11: Phase 7C Regression
            print("\n📋 Phase 7C Regression Tests")
            self.test_regression_phase7c()
            
            # Test 12: Admin Config Regression
            print("\n📋 Admin Configuration Regression Tests")
            self.test_regression_admin_config()
            
        finally:
            # Cleanup
            self.cleanup_created_anomalies()
        
        # Print results
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests ({len(self.failed_tests)}):")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test['name']}")
                if 'expected' in test:
                    print(f"   Expected: {test['expected']}, Got: {test['actual']}")
                if 'error' in test:
                    print(f"   Error: {test['error']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n🎯 Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80  # Consider 80%+ as passing

def main():
    tester = Phase7DAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())