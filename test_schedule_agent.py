"""
Test script for Schedule Agent security implementation
Verifies OAuth2, token validation, and encrypted storage
"""

import requests
import json
import sys
import os

# Add the project root to the path
sys.path.append('.')

from hushh_mcp.consent.token import issue_token, validate_token
from hushh_mcp.types import UserID, AgentID
from hushh_mcp.constants import ConsentScope

# Test configuration
BASE_URL = "http://localhost:8001"
TEST_USER_ID = "test_user_123"

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {str(e)}")
        return False

def test_auth_flow():
    """Test the OAuth authentication flow"""
    print("🔍 Testing OAuth authentication flow...")
    try:
        # Test auth start
        response = requests.get(f"{BASE_URL}/auth/calendar", params={"user_id": TEST_USER_ID})
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Auth start successful: {data.get('auth_url', '')[:50]}...")
            return True
        else:
            print(f"❌ Auth start failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Auth flow error: {str(e)}")
        return False

def test_token_validation():
    """Test token validation with mock tokens"""
    print("🔍 Testing token validation...")
    try:
        # Create a test token
        test_token = issue_token(
            user_id=UserID(TEST_USER_ID),
            agent_id=AgentID("schedule_agent"),
            scope=ConsentScope.CALENDAR_READ,
            expires_in_ms=60 * 60 * 1000  # 1 hour
        )
        
        # Test token validation
        is_valid, error_msg, parsed_token = validate_token(test_token.token, ConsentScope.CALENDAR_READ)
        
        if is_valid:
            print(f"✅ Token validation passed: {parsed_token.user_id}")
            return True
        else:
            print(f"❌ Token validation failed: {error_msg}")
            return False
    except Exception as e:
        print(f"❌ Token validation error: {str(e)}")
        return False

def test_encrypted_storage():
    """Test encrypted storage functionality"""
    print("🔍 Testing encrypted storage...")
    try:
        from hushh_mcp.vault.encrypt import encrypt_data, decrypt_data
        from hushh_mcp.config import AGENT_MASTER_KEY
        
        # Test data
        test_data = "test_calendar_credentials"
        
        # Encrypt
        encrypted = encrypt_data(test_data, AGENT_MASTER_KEY)
        print(f"✅ Data encrypted successfully")
        
        # Decrypt
        decrypted = decrypt_data(encrypted, AGENT_MASTER_KEY)
        
        if decrypted == test_data:
            print(f"✅ Data decrypted successfully: {decrypted}")
            return True
        else:
            print(f"❌ Decryption failed: {decrypted} != {test_data}")
            return False
    except Exception as e:
        print(f"❌ Encrypted storage error: {str(e)}")
        return False

def test_endpoint_security():
    """Test that endpoints require proper authentication"""
    print("🔍 Testing endpoint security...")
    
    # Test endpoints that should require authentication
    endpoints_to_test = [
        "/events",
        "/preferences",
        "/free-busy"
    ]
    
    for endpoint in endpoints_to_test:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", params={
                "token": "invalid_token",
                "user_id": TEST_USER_ID
            })
            
            # Should return 403 for invalid token
            if response.status_code == 403:
                print(f"✅ {endpoint} properly secured")
            else:
                print(f"❌ {endpoint} not properly secured: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error testing {endpoint}: {str(e)}")
            return False
    
    return True

def test_ai_features():
    """Test AI features integration"""
    print("🔍 Testing AI features...")
    try:
        from hushh_mcp.agents.schedule_agent.ai_features import ScheduleAIFeatures
        
        # Initialize AI features
        ai_features = ScheduleAIFeatures()
        
        # Test pattern analysis with mock data
        mock_events = [
            {
                "summary": "Test Meeting",
                "start": {"dateTime": "2024-01-15T10:00:00Z"},
                "end": {"dateTime": "2024-01-15T11:00:00Z"}
            }
        ]
        
        patterns = ai_features.analyze_patterns(mock_events)
        print(f"✅ AI pattern analysis working: {patterns}")
        return True
    except Exception as e:
        print(f"❌ AI features error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Schedule Agent Security Tests\n")
    
    tests = [
        ("Health Check", test_health_check),
        ("OAuth Flow", test_auth_flow),
        ("Token Validation", test_token_validation),
        ("Encrypted Storage", test_encrypted_storage),
        ("Endpoint Security", test_endpoint_security),
        ("AI Features", test_ai_features)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        print(f"Running: {test_name}")
        print('='*50)
        
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} ERROR: {str(e)}")
    
    print(f"\n{'='*50}")
    print(f"TEST RESULTS: {passed}/{total} tests passed")
    print('='*50)
    
    if passed == total:
        print("🎉 All tests passed! Schedule Agent is secure.")
        return 0
    else:
        print("⚠️ Some tests failed. Please review the implementation.")
        return 1

if __name__ == "__main__":
    exit(main()) 