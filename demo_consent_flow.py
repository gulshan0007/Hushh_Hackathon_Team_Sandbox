#!/usr/bin/env python3
"""
Hushh Schedule Agent - Consent Flow Demonstration
================================================

This script demonstrates how the Hushh MCP consent protocol works
with our intelligent schedule agent.

Usage: python demo_consent_flow.py
"""

from hushh_mcp.consent.token import issue_token, validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.agents.schedule_agent.manifest import AGENT_ID, DESCRIPTION, FEATURES

def main():
    print("🤖 Hushh Schedule Agent - Consent Flow Demo")
    print("=" * 50)
    print(f"Agent ID: {AGENT_ID}")
    print(f"Description: {DESCRIPTION}")
    print()
    
    # Demo user
    user_id = "demo_user_123"
    
    print("1️⃣ Issuing Calendar Read Consent Token...")
    read_token = issue_token(
        user_id=user_id,
        agent_id=AGENT_ID,
        scope=ConsentScope.CALENDAR_READ
    )
    print(f"✅ Read Token: {read_token.token[:50]}...")
    print()
    
    print("2️⃣ Issuing Calendar Write Consent Token...")
    write_token = issue_token(
        user_id=user_id,
        agent_id=AGENT_ID,
        scope=ConsentScope.CALENDAR_WRITE
    )
    print(f"✅ Write Token: {write_token.token[:50]}...")
    print()
    
    print("3️⃣ Validating Read Token...")
    valid, reason, parsed = validate_token(
        read_token.token, 
        expected_scope=ConsentScope.CALENDAR_READ
    )
    print(f"✅ Valid: {valid}")
    print(f"📋 User ID: {parsed.user_id}")
    print(f"🔒 Scope: {parsed.scope}")
    print(f"⏰ Expires: {parsed.expires_at}")
    print()
    
    print("4️⃣ Testing Invalid Scope Access...")
    try:
        # Try to use read token for write operation
        valid, reason, parsed = validate_token(
            read_token.token,
            expected_scope=ConsentScope.CALENDAR_WRITE
        )
        if not valid:
            print(f"❌ Access Denied: {reason}")
    except Exception as e:
        print(f"❌ Error: {e}")
    print()
    
    print("5️⃣ Agent Features:")
    for i, feature in enumerate(FEATURES, 1):
        print(f"   {i}. {feature}")
    print()
    
    print("✨ Consent validation successful!")
    print("🔐 Your data is protected by cryptographic consent tokens")
    print("🤖 AI features available with proper permissions")

if __name__ == "__main__":
    main() 