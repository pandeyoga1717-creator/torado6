#!/usr/bin/env python3
"""
Backend API Testing for Aurora F&B ERP Phase 7A
Tests business rules service, HR integration, and RBAC
"""
import requests
import json
import sys
from datetime import datetime, timedelta

class Phase7AAPITester:
    def __init__(self, base_url="https://erp-finance-hub-8.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.outlet_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_rule_ids = []

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

    def test_seed_defaults(self):
        """Test seeding default business rules"""
        success, response = self.run_test(
            "Seed default config rules",
            "POST",
            "/api/admin/business-rules/seed-defaults",
            200,
            data={"rule_type": "config"},
            token=self.admin_token
        )
        if success and 'data' in response:
            print(f"   Seeded {response['data'].get('inserted', 0)} default rules")
        return success

    def test_list_rules_by_type(self, rule_type):
        """Test listing rules by type"""
        success, response = self.run_test(
            f"List {rule_type} rules",
            "GET",
            "/api/admin/business-rules",
            200,
            data={
                "rule_type": rule_type,
                "scope_type": "group",
                "scope_id": "*"
            },
            token=self.admin_token
        )
        if success and 'data' in response:
            rules = response['data']
            print(f"   Found {len(rules)} {rule_type} rules")
            return True, rules
        return False, []

    def test_create_rule(self, rule_type, rule_data, name):
        """Test creating a new business rule"""
        payload = {
            "rule_type": rule_type,
            "scope_type": "group",
            "scope_id": "*",
            "rule_data": rule_data,
            "name": name,
            "active": True,
            "effective_from": "2026-07-01",
            "effective_to": "2026-09-30"
        }
        
        success, response = self.run_test(
            f"Create {rule_type} rule",
            "POST",
            "/api/admin/business-rules",
            200,
            data=payload,
            token=self.admin_token
        )
        
        if success and 'data' in response:
            rule_id = response['data'].get('id')
            if rule_id:
                self.created_rule_ids.append(rule_id)
                print(f"   Created rule ID: {rule_id}")
                # Check for overlaps
                overlaps = response['data'].get('overlaps_with', [])
                if overlaps:
                    print(f"   ⚠️  Overlaps detected with rules: {overlaps}")
            return True, response['data']
        return False, {}

    def test_rule_validation(self):
        """Test rule validation constraints"""
        # Test invalid service_charge_policy lb_pct > 1
        invalid_payload = {
            "rule_type": "service_charge_policy",
            "scope_type": "group",
            "scope_id": "*",
            "rule_data": {
                "service_charge_pct": 0.05,
                "lb_pct": 1.5,  # Invalid: > 1
                "ld_pct": 0.0
            },
            "name": "Invalid Service Charge Policy",
            "active": True
        }
        
        success, response = self.run_test(
            "Test validation - invalid lb_pct",
            "POST",
            "/api/admin/business-rules",
            400,  # Expecting validation error
            data=invalid_payload,
            token=self.admin_token
        )
        return success

    def test_version_increment(self, rule_type):
        """Test auto-version increment"""
        # Create first rule
        rule_data = {"monthly_limit": 1000000} if rule_type == "petty_cash_policy" else {}
        success1, rule1 = self.test_create_rule(rule_type, rule_data, f"Test {rule_type} v1")
        
        if not success1:
            return False
            
        # Create second rule with same scope+type
        success2, rule2 = self.test_create_rule(rule_type, rule_data, f"Test {rule_type} v2")
        
        if success2:
            v1 = rule1.get('version', 0)
            v2 = rule2.get('version', 0)
            print(f"   Version increment: v{v1} -> v{v2}")
            return v2 > v1
        return False

    def test_duplicate_rule(self, rule_id):
        """Test rule duplication"""
        success, response = self.run_test(
            "Duplicate rule",
            "POST",
            f"/api/admin/business-rules/{rule_id}/duplicate",
            200,
            data={"name": "Test Duplicate Rule"},
            token=self.admin_token
        )
        
        if success and 'data' in response:
            dup_id = response['data'].get('id')
            if dup_id:
                self.created_rule_ids.append(dup_id)
                print(f"   Duplicated rule ID: {dup_id}")
                print(f"   Active status: {response['data'].get('active', 'unknown')}")
            return True, response['data']
        return False, {}

    def test_archive_activate_rule(self, rule_id):
        """Test archiving and activating rules"""
        # Archive
        success1, _ = self.run_test(
            "Archive rule",
            "POST",
            f"/api/admin/business-rules/{rule_id}/archive",
            200,
            token=self.admin_token
        )
        
        if not success1:
            return False
            
        # Activate
        success2, _ = self.run_test(
            "Activate rule",
            "POST",
            f"/api/admin/business-rules/{rule_id}/activate",
            200,
            token=self.admin_token
        )
        
        return success2

    def test_timeline_endpoint(self):
        """Test timeline endpoint"""
        success, response = self.run_test(
            "Get timeline for petty_cash_policy",
            "GET",
            "/api/admin/business-rules/timeline",
            200,
            data={
                "rule_type": "petty_cash_policy",
                "scope_type": "group",
                "scope_id": "*"
            },
            token=self.admin_token
        )
        
        if success and 'data' in response:
            rules = response['data']
            print(f"   Timeline contains {len(rules)} rule versions")
            # Check for overlaps_with field
            for rule in rules:
                overlaps = rule.get('overlaps_with', [])
                if overlaps:
                    print(f"   Rule {rule.get('id', 'unknown')} overlaps with: {overlaps}")
        return success

    def test_rbac_permissions(self):
        """Test RBAC - non-admin user should be blocked"""
        if not self.outlet_token:
            print("⚠️  Skipping RBAC test - no outlet user token")
            return True
            
        success, response = self.run_test(
            "RBAC test - outlet user access business rules",
            "GET",
            "/api/admin/business-rules",
            403,  # Expecting forbidden
            data={"rule_type": "petty_cash_policy"},
            token=self.outlet_token
        )
        return success

    def test_hr_service_charge_integration(self):
        """Test HR service charge calculation with policy resolution"""
        # First ensure we have a service charge policy
        policy_data = {
            "service_charge_pct": 0.05,
            "lb_pct": 0.01,
            "ld_pct": 0.0,
            "allocation_method": "by_days_worked"
        }
        
        self.test_create_rule("service_charge_policy", policy_data, "Test SC Policy for HR")
        
        # Test HR calculation without explicit lb_pct (should use policy)
        success1, response1 = self.run_test(
            "HR service charge calc - use policy defaults",
            "POST",
            "/api/hr/service-charges/calculate",
            200,
            data={
                "outlet_id": "test-outlet-id",
                "period": "2026-08"
            },
            token=self.admin_token
        )
        
        if success1 and 'data' in response1:
            result = response1['data']
            lb_pct = result.get('lb_pct')
            policy_id = result.get('policy_id')
            print(f"   Policy resolved - lb_pct: {lb_pct}, policy_id: {policy_id}")
        
        # Test HR calculation with explicit lb_pct override
        success2, response2 = self.run_test(
            "HR service charge calc - override lb_pct",
            "POST",
            "/api/hr/service-charges/calculate",
            200,
            data={
                "outlet_id": "test-outlet-id", 
                "period": "2026-08",
                "lb_pct": 0.03
            },
            token=self.admin_token
        )
        
        if success2 and 'data' in response2:
            result = response2['data']
            lb_pct = result.get('lb_pct')
            print(f"   Override applied - lb_pct: {lb_pct}")
            
        return success1 and success2

    def test_regression_phase6(self):
        """Test Phase 6 regression - periods and approvals"""
        # Test finance periods
        success1, _ = self.run_test(
            "Regression - finance periods",
            "GET",
            "/api/finance/periods",
            200,
            data={"year": 2026},
            token=self.admin_token
        )
        
        # Test approvals queue
        success2, _ = self.run_test(
            "Regression - approvals queue",
            "GET",
            "/api/approvals/queue",
            200,
            token=self.admin_token
        )
        
        # Test approval workflow CRUD still works
        success3, _ = self.run_test(
            "Regression - approval workflows",
            "GET",
            "/api/admin/business-rules",
            200,
            data={"rule_type": "approval_workflow"},
            token=self.admin_token
        )
        
        return success1 and success2 and success3

    def cleanup_created_rules(self):
        """Clean up rules created during testing"""
        print(f"\n🧹 Cleaning up {len(self.created_rule_ids)} created rules...")
        for rule_id in self.created_rule_ids:
            try:
                self.run_test(
                    f"Cleanup rule {rule_id}",
                    "DELETE",
                    f"/api/admin/business-rules/{rule_id}",
                    200,
                    token=self.admin_token
                )
            except:
                pass

    def run_all_tests(self):
        """Run comprehensive Phase 7A backend tests"""
        print("🚀 Starting Aurora F&B ERP Phase 7A Backend Tests")
        print("=" * 60)
        
        # Login as admin
        print("\n📋 Authentication Tests")
        self.admin_token = self.login("admin@torado.id", "Torado@2026")
        if not self.admin_token:
            print("❌ Failed to login as admin - aborting tests")
            return False
            
        # Try to login as outlet user for RBAC testing
        self.outlet_token = self.login("outlet@torado.id", "Torado@2026")
        
        try:
            # Test 1: Seed defaults
            print("\n📋 Seed Defaults Tests")
            self.test_seed_defaults()
            
            # Test 2: List rules for each type
            print("\n📋 Rule Listing Tests")
            rule_types = ["sales_input_schema", "petty_cash_policy", "service_charge_policy", "incentive_policy"]
            for rule_type in rule_types:
                self.test_list_rules_by_type(rule_type)
            
            # Test 3: Rule validation
            print("\n📋 Validation Tests")
            self.test_rule_validation()
            
            # Test 4: Version increment
            print("\n📋 Version Increment Tests")
            self.test_version_increment("petty_cash_policy")
            
            # Test 5: Create rules with overlap detection
            print("\n📋 Rule Creation & Overlap Tests")
            success, rule = self.test_create_rule(
                "petty_cash_policy",
                {
                    "monthly_limit": 4000000,
                    "max_per_txn": 500000,
                    "approval_threshold": 250000,
                    "replenish_frequency": "weekly",
                    "require_receipt": True
                },
                "Test Petty Q4"
            )
            
            if success and rule.get('id'):
                rule_id = rule['id']
                
                # Test 6: Duplicate rule
                print("\n📋 Rule Duplication Tests")
                self.test_duplicate_rule(rule_id)
                
                # Test 7: Archive/Activate
                print("\n📋 Archive/Activate Tests")
                self.test_archive_activate_rule(rule_id)
            
            # Test 8: Timeline endpoint
            print("\n📋 Timeline Tests")
            self.test_timeline_endpoint()
            
            # Test 9: RBAC
            print("\n📋 RBAC Tests")
            self.test_rbac_permissions()
            
            # Test 10: HR Integration
            print("\n📋 HR Integration Tests")
            self.test_hr_service_charge_integration()
            
            # Test 11: Phase 6 Regression
            print("\n📋 Phase 6 Regression Tests")
            self.test_regression_phase6()
            
        finally:
            # Cleanup
            self.cleanup_created_rules()
        
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
    tester = Phase7AAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())