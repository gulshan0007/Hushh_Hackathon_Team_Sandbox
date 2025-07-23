# hushh_mcp/trust/link.py

import hmac
import hashlib
import time
from typing import List
from hushh_mcp.types import TrustLink, UserID, AgentID, ConsentScope
from hushh_mcp.constants import TRUST_LINK_PREFIX
from hushh_mcp.config import SECRET_KEY, DEFAULT_TRUST_LINK_EXPIRY_MS

# ========== TrustLink Creator ==========

def create_trust_link(
    from_agent: AgentID,
    to_agent: AgentID,
    scope: ConsentScope,
    signed_by_user: UserID,
    expires_in_ms: int = DEFAULT_TRUST_LINK_EXPIRY_MS
) -> TrustLink:
    """Create a trust link between two agents for a specific scope"""
    created_at = int(time.time() * 1000)
    expires_at = created_at + expires_in_ms

    raw = f"{from_agent}|{to_agent}|{scope}|{created_at}|{expires_at}|{signed_by_user}"
    signature = _sign(raw)

    return TrustLink(
        from_agent=from_agent,
        to_agent=to_agent,
        scope=scope,
        created_at=created_at,
        expires_at=expires_at,
        signed_by_user=signed_by_user,
        signature=signature
    )

# ========== TrustLink Verifier ==========

def verify_trust_link(
    link: TrustLink,
    from_agent: AgentID,
    to_agent: AgentID,
    required_scopes: List[ConsentScope]
) -> bool:
    """Verify a trust link is valid and has the required scopes"""
    try:
        # Check expiry
        now = int(time.time() * 1000)
        if now > link.expires_at:
            print(f"❌ Trust link expired: {link.expires_at} < {now}")
            return False

        # Check agents match
        if link.from_agent != from_agent or link.to_agent != to_agent:
            print(f"❌ Agent mismatch: {link.from_agent} -> {link.to_agent} vs {from_agent} -> {to_agent}")
            return False

        # Check signature
        raw = f"{link.from_agent}|{link.to_agent}|{link.scope}|{link.created_at}|{link.expires_at}|{link.signed_by_user}"
        expected_sig = _sign(raw)
        
        if not hmac.compare_digest(link.signature, expected_sig):
            print("❌ Invalid signature")
            return False

        # Check scope
        if link.scope not in required_scopes:
            print(f"❌ Missing required scope: {link.scope} not in {required_scopes}")
            return False

        return True

    except Exception as e:
        print(f"❌ Error verifying trust link: {str(e)}")
        return False

# ========== Scope Validator ==========

def is_trusted_for_scope(link: TrustLink, required_scope: ConsentScope) -> bool:
    """Check if a trust link is valid for a specific scope"""
    try:
        return verify_trust_link(link, link.from_agent, link.to_agent, [required_scope])
    except Exception as e:
        print(f"❌ Error checking scope trust: {str(e)}")
        return False

# ========== Internal Signer ==========

def _sign(input_string: str) -> str:
    """Generate HMAC signature for a trust link"""
    return hmac.new(
        SECRET_KEY.encode(),
        input_string.encode(),
        hashlib.sha256
    ).hexdigest()
